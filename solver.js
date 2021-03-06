"use strict";
var solver = (function () {
    function det2x2(a, b, c, d) {
        var C = Math.pow(2, 27) + 1;

        function veltkamp(val) {
            var p = val * C;
            var q = val - p;
            var val1 = p + q;
            return [val1, val - val1];
        }

        function mult(a, b) {
            var va = veltkamp(a);
            var vb = veltkamp(b);
            var r1 = a * b;
            var t1 = -r1 + va[0] * vb[0];
            var t2 = t1 + va[0] * vb[1];
            var t3 = t2 + va[1] * vb[0];
            var r2 = t3 + va[1] * vb[1];
            return [r1, r2];
        }

        function twoDiff(a, b) {
            var s = a - b;
            var bb = s - a;
            var err = (a - (s - bb)) - (b + bb);
            return [s, err];
        }

        function quickTwoSum(a, b) {
            var res = a + b;
            var e = b - (res - a);
            return [res, e];
        }

        function subtraction(a, b) {
            var s = twoDiff(a[0], b[0]);
            var t = twoDiff(a[1], b[1]);
            var s2 = s[1] + t[1];
            var g = quickTwoSum(s[0], s2);
            s2 = g[1] + t[1];
            return quickTwoSum(g[0], s2);
        }

        var v1 = mult(a, d);
        var v2 = mult(b, c);
        var res = subtraction(v1, v2);
        return res[0];
    }

    function EquationSystemCreator() {
        this.quadraticEquations = [];
        this.linearEquations = [];
        this.segments = [];
    }

    EquationSystemCreator.prototype = {
        _addEquation: function (quadratic, a, b, k, c) {
            var equation = {a: a, b: b, k: k, c: c};
            if (quadratic)
                this.quadraticEquations.push(equation);
            else
                this.linearEquations.push(equation);
        },
        addVertex: function (vertex) {
            this._addEquation(1, -2 * vertex.x, -2 * vertex.y, 0, vertex.x * vertex.x + vertex.y * vertex.y);
            return this;
        },
        addSegment: function (segment) {
            //here is some cheating.
            // if we receive 2 collinear segments having a common point, we substitute the second segment by the common point
            // this case arises with collinear edges.
            for (var i = 0; i < this.segments.length; i++) {
                var other = this.segments[i];
                var commonPoint = commonVertex(segment, other);
                var v1 = segmentToVector(segment);
                var v2 = segmentToVector(other);
                if (commonPoint && det2x2(v1.x, v1.y, v2.x, v2.y) == 0)
                    return this.addVertex(commonPoint);
            }
            this.segments.push(segment);
            var length = segLength(segment);
            var slope = det2x2(segment[1].x, segment[0].x, segment[1].y, segment[0].y) / length;
            var a = (segment[1].y - segment[0].y) / length;
            var b = -(segment[1].x - segment[0].x) / length;
            this._addEquation(0, a, b, 1, slope);
            return this;
        }
    };

// https://github.com/aewallin/openvoronoi/blob/master/src/solvers/solver_qll.hpp
// http://www.payne.org/index.php/Calculating_Voronoi_Nodes
    function solveEquations(creator, solutionsFilter) {
        function subtractEquations(eLeft, eRight) {
            var newEquation = {};
            for (var key in eLeft)
                if (eLeft.hasOwnProperty(key))
                    newEquation[key] = eLeft[key] - eRight[key];
            return newEquation;
        }

        if (!solutionsFilter)
            solutionsFilter = function () {
                return true;
            };
        function solve(linearEquations, xi, yi, ti, quadraticEquation) {
            var firstEq = linearEquations[0];
            var secondEq = linearEquations[1];
            var determinant = det2x2(firstEq[xi], secondEq[xi], firstEq[yi], secondEq[yi]);
            if (determinant == 0)
                return [];
            var a0 = det2x2(firstEq[yi], secondEq[yi], firstEq[ti], secondEq[ti]) / determinant;
            var a1 = -det2x2(firstEq[xi], secondEq[xi], firstEq[ti], secondEq[ti]) / determinant;
            var b0 = det2x2(firstEq[yi], secondEq[yi], firstEq.c, secondEq.c) / determinant;
            var b1 = -det2x2(firstEq[xi], secondEq[xi], firstEq.c, secondEq.c) / determinant;

            var aargs = {
                a: [1, quadraticEquation.a],
                b: [1, quadraticEquation.b],
                k: [-1, quadraticEquation.k]
            };
            var solutions = qll_solve(aargs[xi][0], aargs[xi][1],
                aargs[yi][0], aargs[yi][1],
                aargs[ti][0], aargs[ti][1],
                quadraticEquation.c, // xk*xk + yk*yk - rk*rk,
                a0, b0, a1, b1);
            var realSolutions = [];
            for (var i = 0; i < solutions.length; i++) {
                var o = {};
                o[xi] = solutions[i].a;
                o[yi] = solutions[i].b;
                o[ti] = solutions[i].k;
                var point = {x: o.a, y: o.b, r: o.k};
                if (solutionsFilter(point))
                    realSolutions.push(point);
            }
            return realSolutions;
        }

        function qll_solve(a0, b0, c0, d0, e0, f0, g0, a1, b1, a2, b2) {
            var a = a0 * (a1 * a1) + c0 * (a2 * a2) + e0;
            var b = 2 * a0 * a1 * b1 + 2 * a2 * b2 * c0 + a1 * b0 + a2 * d0 + f0;
            var c = a0 * (b1 * b1) + c0 * (b2 * b2) + b0 * b1 + b2 * d0 + g0;
            var roots = quadratic_roots(a, b, c);

            if (roots.length == 0)
                return [];
            var solutions = [];
            for (var i = 0; i < roots.length; i++) {
                var w = roots[i];
                solutions.push({a: a1 * w + b1, b: a2 * w + b2, k: w});
            }
            return solutions;
        }

        function quadratic_roots(a, b, c) {
            if (!a && !b)
                return [];
            if (!a)
                return [-c / b];
            if (!b) {
                var sqr = -c / a;
                if (sqr > 0)
                    return [Math.sqrt(sqr), -Math.sqrt(sqr)];
                else if (sqr == 0)
                    return [0];
                return [];
            }
            var discriminant = det2x2(b, 4 * a, c, b); // b * b - 4 * a * c;
            if (discriminant > 0) {
                var q = b > 0 ? (b + Math.sqrt(discriminant)) / -2 : (b - Math.sqrt(discriminant)) / -2;
                return [q / a, c / q];
                //not really proud of that one, but I found cases where I couldn't get a good result
            } else if (discriminant == 0 || Math.abs(discriminant / (b * b)) < Math.pow(2, -50))
                return [-b / (2 * a)];
            return [];
        }

        function clone(array) {
            return array.slice(0);
        }

        function solveLinear(equations) {
            var matrix = [];
            var rhs = [];
            for (var i = 0; i < equations.length; i++) {
                var equation = equations[i];
                matrix.push([equation.a, equation.b, equation.k]);
                rhs.push(-equation.c);
            }
            var result = numeric.solve(matrix, rhs);
            if (isFinite(result[0]) && isFinite(result[1]) && isFinite(result[2])) {
                var res = {x: result[0], y: result[1], r: result[2]};
                if (solutionsFilter(res))
                    return [res];
            }
            return [];
        }

        var quadraticEquations = clone(creator.quadraticEquations);
        var linearEquations = clone(creator.linearEquations);
        var quadLength = quadraticEquations.length;
        var linLength = linearEquations.length;
        if (quadLength + linLength != 3)
            throw new Error('should have 3 equations, had ' + quadLength + ' quadratic equations and ' + linLength + ' linear equations.');

        if (quadraticEquations.length == 0)
            return solveLinear(linearEquations);

        var firstQuad = quadraticEquations[0];
        if (quadraticEquations.length > 1)
            for (var i = 1; i < quadLength; i++)
                linearEquations.push(subtractEquations(quadraticEquations[i], firstQuad));
        var solutions = [];
        solutions = solutions.concat(solve(linearEquations, 'a', 'b', 'k', firstQuad));
        if (!solutions.length)
            solutions = solutions.concat(solve(linearEquations, 'k', 'a', 'b', firstQuad));
        if (!solutions.length)
            solutions = solutions.concat(solve(linearEquations, 'b', 'k', 'a', firstQuad));
        return solutions;
    }

    return {
        solveEquations: solveEquations,
        EquationSystemCreator: EquationSystemCreator
    };
})();
