import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Wrap a handler so unexpected errors become a clean 500 instead of a crash. */
export function withErrorHandling<Args extends unknown[]>(
  label: string,
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error(`[${label}]`, err);
      return jsonError("Internal server error", 500);
    }
  };
}
