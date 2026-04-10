export const securitySchemes = {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description:
        "Pega aquí el session_token generado por /uber/auth/callback. Swagger enviará Authorization: Bearer <token>."
    }
  };