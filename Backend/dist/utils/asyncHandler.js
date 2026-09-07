/**
 * Higher-order function that catches async errors in route handlers and passes them to NextFunction.
 */
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
