export type AdminActionStatus =
  | 200
  | 201
  | 400
  | 401
  | 403
  | 404
  | 409
  | 500;

export type AdminActionResult<T = never> =
  | {
      ok: true;
      status: 200 | 201;
      message: string;
      data?: T;
    }
  | {
      ok: false;
      status: Exclude<AdminActionStatus, 200 | 201>;
      error: string;
    };
