import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError.js";
/**
 * Zod schema validator middleware for Express requests.
 * Automatically validates req.body, req.query, and req.params against the provided schema.
 */
export const validate = (schema) => {
    return async (req, res, next) => {
        try {
            const parsed = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            // Assign parsed & sanitized values back to request
            if (parsed.body)
                req.body = parsed.body;
            if (parsed.query)
                req.query = parsed.query;
            if (parsed.params)
                req.params = parsed.params;
            next();
        }
        catch (error) {
            if (error instanceof ZodError) {
                const formattedErrors = error.errors.map((err) => ({
                    field: err.path.join("."),
                    message: err.message,
                }));
                const summary = formattedErrors.map((e) => `${e.field}: ${e.message}`).join(", ");
                next(ApiError.badRequest(`Doğrulama hatası: ${summary}`, formattedErrors));
            }
            else {
                next(error);
            }
        }
    };
};
