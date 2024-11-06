import { MyMath } from "../../monax/MyMath";

export class InterpolationUtils {

    /**
     * Calculates the Bernstein basis from the three factorial coefficients.
     * @param {number} n - The first value.
     * @param {number} i - The second value.
     *
     * @return {number} The Bernstein basis of Factorial(n) / Factorial(i) / Factorial(n - i)
     */
    static bernstein(n, i) {
        return MyMath.factorial(n) / MyMath.factorial(i) / MyMath.factorial(n - i);
    };

    /**
     * Linear Interpolation
     * @param a - Start value
     * @param b - Finish value
     * @param t - time in [0..1]
     * @returns Result value between [a..b] by time
     */
    public static linear(a: number, b: number, t: number): number {
        return a + (b - a) * t;
    }

    /**
    * Bezier interpolation method.
    * @param {number[]} v - The input array of values to interpolate between.
    * @param {number} k - The percentage of interpolation, between 0 and 1.
    *
    * @return {number} The interpolated value.
    */
    public static bezier(v: number[], k: number) {
        var b = 0;
        var n = v.length - 1;
        for (var i = 0; i <= n; i++) {
            b += Math.pow(1 - k, n - i) * Math.pow(k, i) * v[i] * this.bernstein(n, i);
        }
        return b;
    }

}

export class MySpline {
    private _points: { val: number, t: number }[];
    /**
     * (a, b, t)
     */
    private _lerp?: Function;

    constructor(aLerp?: Function) {
        this._points = [];
        this._lerp = aLerp || InterpolationUtils.linear;
    }

    addPoint(val: number, t: number): MySpline {
        this._points.push({ t: t, val: val });
        return this;
    }

    getValue(t: number): number {
        let p1 = 0;

        for (let i = 0; i < this._points.length; i++) {
            if (this._points[i].t >= t) {
                break;
            }
            p1 = i;
        }

        const p2 = Math.min(this._points.length - 1, p1 + 1);

        if (p1 == p2) {
            return this._points[p1].val;
        }

        return this._lerp(
            this._points[p1].val, this._points[p2].val,
            (t - this._points[p1].t) / (this._points[p2].t - this._points[p1].t)
        );
    }
}
