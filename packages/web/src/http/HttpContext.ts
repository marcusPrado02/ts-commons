export interface HttpRequest {
  readonly method: string;
  readonly url: string;
  readonly path: string;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly query: Record<string, string | string[] | undefined>;
  readonly params: Record<string, string>;
  readonly body?: unknown;
}

export interface HttpResponse {
  readonly statusCode: number;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
}

export interface HttpContext {
  request: HttpRequest;
  response: HttpResponse;
  locals: Map<string, unknown>;
}
