// swagger.js
const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "My API",
      version: "1.0.0",
      description: "API documentation",
    },
    servers: [
      {
        url: "https://5944-125-25-17-122.ngrok-free.app/", // เปลี่ยนเป็น URL จริงตอน Deploy
      },
    ],
  },
  apis: ["./*.js"], // ที่อยู่ของไฟล์ที่มี Swagger comments
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = (app) => {
  app.use("/api", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
