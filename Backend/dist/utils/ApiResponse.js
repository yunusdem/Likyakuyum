import { HttpStatus } from "../constants/httpStatusCodes.js";
export class ApiResponse {
    success;
    message;
    data;
    meta;
    constructor(message, data, meta) {
        this.success = true;
        this.message = message;
        if (data !== undefined)
            this.data = data;
        if (meta !== undefined)
            this.meta = meta;
    }
    static send(res, statusCode = HttpStatus.OK, message = "İşlem başarılı", data, meta) {
        const responsePayload = new ApiResponse(message, data, meta);
        return res.status(statusCode).json(responsePayload);
    }
    static ok(res, message = "İşlem başarılı", data, meta) {
        return ApiResponse.send(res, HttpStatus.OK, message, data, meta);
    }
    static created(res, message = "Kayıt başarıyla oluşturuldu", data) {
        return ApiResponse.send(res, HttpStatus.CREATED, message, data);
    }
    static noContent(res) {
        return res.status(HttpStatus.NO_CONTENT).send();
    }
}
