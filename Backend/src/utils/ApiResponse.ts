import { Response } from "express";
import { HttpStatus, HttpStatusCode } from "../constants/httpStatusCodes.js";
import { IApiResponse } from "../types/api.types.js";

export class ApiResponse<T = any> {
  public success: boolean;
  public message: string;
  public data?: T;
  public meta?: IApiResponse["meta"];

  constructor(message: string, data?: T, meta?: IApiResponse["meta"]) {
    this.success = true;
    this.message = message;
    if (data !== undefined) this.data = data;
    if (meta !== undefined) this.meta = meta;
  }

  public static send<T>(
    res: Response,
    statusCode: HttpStatusCode = HttpStatus.OK,
    message: string = "İşlem başarılı",
    data?: T,
    meta?: IApiResponse["meta"]
  ): Response {
    const responsePayload = new ApiResponse<T>(message, data, meta);
    return res.status(statusCode).json(responsePayload);
  }

  public static ok<T>(
    res: Response,
    message: string = "İşlem başarılı",
    data?: T,
    meta?: IApiResponse["meta"]
  ): Response {
    return ApiResponse.send(res, HttpStatus.OK, message, data, meta);
  }

  public static created<T>(
    res: Response,
    message: string = "Kayıt başarıyla oluşturuldu",
    data?: T
  ): Response {
    return ApiResponse.send(res, HttpStatus.CREATED, message, data);
  }

  public static noContent(res: Response): Response {
    return res.status(HttpStatus.NO_CONTENT).send();
  }
}
