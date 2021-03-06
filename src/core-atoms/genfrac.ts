import { Atom, ToLatexOptions } from '../core/atom-class';
import { MATHSTYLES, MathStyleName } from '../core/mathstyle';
import { Span, makeHlist, makeVlist } from '../core/span';
import { makeCustomSizedDelim, makeNullFence } from '../core/delimiters';
import { Context } from '../core/context';
import { Style } from '../public/core';
import {
  METRICS as FONTMETRICS,
  SIZING_MULTIPLIER,
} from '../core/font-metrics';

export type GenfracOptions = {
  continuousFraction?: boolean;
  numerPrefix?: string;
  denomPrefix?: string;
  leftDelim?: string;
  rightDelim?: string;
  hasBarLine?: boolean;
  mathStyleName?: MathStyleName | 'auto';
  style?: Style;
  toLatexOverride?: (atom: GenfracAtom, options: ToLatexOptions) => string;
};

/**
 * Gengrac -- Generalized fraction
 *
 * Decompose fractions, binomials, and in general anything made
 * of two expressions on top of each other, optionally separated by a bar,
 * and optionally surrounded by fences (parentheses, brackets, etc...)
 *
 * Depending on the type of fraction the mathstyle is either
 * display math or inline math (which is indicated by 'textstyle'). This value can
 * also be set to 'auto', which indicates it should use the current mathstyle
 */
export class GenfracAtom extends Atom {
  leftDelim?: string;
  rightDelim?: string;
  hasBarLine: boolean;
  private readonly continuousFraction: boolean;
  private readonly numerPrefix?: string;
  private readonly denomPrefix?: string;
  private readonly mathStyleName: MathStyleName | 'auto';
  constructor(
    command: string,
    above: Atom[],
    below: Atom[],
    options?: GenfracOptions
  ) {
    super('genfrac', {
      style: options.style,
      command,
      toLatexOverride: options.toLatexOverride,
    });
    this.above = above;
    this.below = below;
    this.hasBarLine = options?.hasBarLine ?? true;
    this.continuousFraction = options?.continuousFraction ?? false;
    this.numerPrefix = options?.numerPrefix;
    this.denomPrefix = options?.denomPrefix;
    this.mathStyleName = options?.mathStyleName ?? 'auto';
    this.leftDelim = options?.leftDelim;
    this.rightDelim = options?.rightDelim;
  }

  toLatex(options: ToLatexOptions): string {
    return (
      this.command +
      `{${this.aboveToLatex(options)}}` +
      `{${this.belowToLatex(options)}}`
    );
  }

  render(context: Context): Span {
    const outerstyle =
      this.mathStyleName === 'auto'
        ? context.mathstyle
        : MATHSTYLES[this.mathStyleName];
    const newContext = context.clone({ mathstyle: outerstyle });
    const isTight = newContext.mathstyle.isTight();
    const style = this.computedStyle;

    const numeratorStyle = this.continuousFraction
      ? outerstyle
      : outerstyle.fracNum();
    const numer = this.numerPrefix
      ? makeHlist(
          [
            new Span(this.numerPrefix, { type: 'mord', isTight }),
            Atom.render(
              newContext.clone({ mathstyle: numeratorStyle }),
              this.above
            ),
          ],
          { isTight }
        )
      : Atom.render(
          newContext.clone({ mathstyle: numeratorStyle }),
          this.above
        ) ?? new Span(null);

    const denominatorStyle = this.continuousFraction
      ? outerstyle
      : outerstyle.fracDen();
    const denom = this.denomPrefix
      ? makeHlist([
          new Span(this.denomPrefix, { type: 'mord' }),
          Atom.render(
            newContext.clone({ mathstyle: denominatorStyle }),
            this.below
          ),
        ])
      : Atom.render(
          newContext.clone({ mathstyle: denominatorStyle }),
          this.below
        ) ?? new Span(null);
    const ruleWidth = !this.hasBarLine
      ? 0
      : FONTMETRICS.defaultRuleThickness / outerstyle.sizeMultiplier;
    // Rule 15b from TeXBook Appendix G, p.444
    //
    // 15b. If C > T, set u ← σ8 and v ← σ11. Otherwise set u ← σ9 or σ10,according
    // as θ ̸= 0 or θ = 0, and set v ← σ12. (The fraction will be typeset with
    // its numerator shifted up by an amount u with respect to the current
    // baseline, and with the denominator shifted down by v, unless the boxes
    // are unusually large.)
    let numerShift: number;
    let clearance = 0;
    let denomShift: number;
    if (outerstyle.size === MATHSTYLES.displaystyle.size) {
      numerShift = outerstyle.metrics.num1; // Set u ← σ8
      clearance =
        ruleWidth > 0 ? 3 * ruleWidth : 7 * FONTMETRICS.defaultRuleThickness;
      denomShift = outerstyle.metrics.denom1; // V ← σ11
    } else {
      if (ruleWidth > 0) {
        numerShift = outerstyle.metrics.num2; // U ← σ9
        clearance = ruleWidth; //  Φ ← θ
      } else {
        numerShift = outerstyle.metrics.num3; // U ← σ10
        clearance = 3 * FONTMETRICS.defaultRuleThickness; // Φ ← 3 ξ8
      }

      denomShift = outerstyle.metrics.denom2; // V ← σ12
    }

    const numerDepth = numer.depth;
    const denomHeight = denom.height;
    let frac: Span;
    if (ruleWidth === 0) {
      // Rule 15c from Appendix G
      // No bar line between numerator and denominator
      const candidateClearance =
        numerShift - numerDepth - (denomHeight - denomShift);
      if (candidateClearance < clearance) {
        numerShift += (clearance - candidateClearance) / 2;
        denomShift += (clearance - candidateClearance) / 2;
      }

      frac = makeVlist(
        newContext,
        [
          [numer, -numerShift],
          [denom, denomShift],
        ],
        'individualShift',
        {
          classes:
            'mfrac' + context.parentMathstyle.adjustTo(newContext.mathstyle),
        }
      );
    } else {
      // Rule 15d from Appendix G
      // There is a bar line between the numerator and the denominator
      let { axisHeight } = outerstyle.metrics;
      axisHeight *= SIZING_MULTIPLIER[this.style?.fontSize ?? 'size5'];
      const numerLine = axisHeight + ruleWidth / 2;
      const denomLine = axisHeight - ruleWidth / 2;
      if (numerShift < clearance + numerDepth + numerLine) {
        numerShift = clearance + numerDepth + numerLine;
      }

      if (denomShift < clearance + denomHeight - denomLine) {
        denomShift = clearance + denomHeight - denomLine;
      }

      const fracLine = new Span(null, {
        classes: 'frac-line',
        mode: this.mode,
        style,
      });
      // Manually set the height of the frac line because its height is
      // created in CSS
      fracLine.height = ruleWidth / 2;
      fracLine.depth = ruleWidth / 2;
      frac = makeVlist(
        newContext,
        [
          [denom, denomShift],
          [fracLine, -denomLine],
          [numer, -numerShift],
        ],
        'individualShift',
        {
          classes:
            'mfrac' + context.parentMathstyle.adjustTo(newContext.mathstyle),
        }
      );
    }

    // Since we manually change the style sometimes (with \dfrac or \tfrac),
    // account for the possible size change here.
    frac.height *= outerstyle.sizeMultiplier / context.mathstyle.sizeMultiplier;
    frac.depth *= outerstyle.sizeMultiplier / context.mathstyle.sizeMultiplier;

    // Rule 15e of Appendix G
    const delimSize =
      outerstyle.size === MATHSTYLES.displaystyle.size
        ? outerstyle.metrics.delim1
        : outerstyle.metrics.delim2;
    const delimContext = context.clone({
      mathstyle: outerstyle,
      size: this.style?.fontSize ?? 'size5',
    });
    const delimSizingClass =
      context.parentSize !== delimContext.size
        ? 'sizing reset-' + context.parentSize + ' ' + delimContext.size
        : '';

    // Optional delimiters
    const leftDelim = this.leftDelim
      ? this.bind(
          context,
          makeCustomSizedDelim(
            'mopen',
            this.leftDelim,
            delimSize,
            true,
            delimContext,
            { style, mode: this.mode, classes: delimSizingClass }
          )
        )
      : new Span(null);

    let rightDelim: Span;
    if (this.continuousFraction) {
      rightDelim = makeNullFence(context, 'mclose');
    } else if (!this.rightDelim) {
      rightDelim = new Span(null);
    } else {
      rightDelim = this.bind(
        context,
        makeCustomSizedDelim(
          'mclose',
          this.rightDelim,
          delimSize,
          true,
          context.clone({ mathstyle: outerstyle }),
          { style, mode: this.mode, classes: delimSizingClass }
        )
      );
    }

    const result = this.bind(
      context,
      // MakeStruts(
      new Span(
        [leftDelim, frac, rightDelim],
        {
          isTight,
          classes:
            context.parentSize !== context.size
              ? 'sizing reset-' + context.parentSize + ' ' + context.size
              : '',
          type: 'minner', // TexBook p. 170 "fractions are treated as type Inner."
        }
        // )
      )
    );

    if (this.caret) result.caret = this.caret;

    return this.attachSupsub(context, result, result.type);
  }
}
