import { Request, Response } from "express";

export function getPrivacyPage(_req: Request, res: Response): void {
  res.status(200).type("html").send(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Política de Privacidad | Pollos Pirata Uber Eats</title>
        <style>
          body {
            font-family: Arial, Helvetica, sans-serif;
            max-width: 960px;
            margin: 40px auto;
            padding: 0 20px;
            line-height: 1.7;
            color: #222;
            background: #ffffff;
          }
          h1, h2 {
            color: #111827;
          }
          .card {
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 28px;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
          }
          p, li {
            font-size: 15px;
          }
          ul {
            padding-left: 22px;
          }
          .muted {
            color: #6b7280;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Política de Privacidad</h1>
          <p class="muted">
            Última actualización: ${new Date().toLocaleDateString("es-MX")}
          </p>

          <p>
            Esta Política de Privacidad describe cómo el sistema de integración de
            <strong>Pollos Pirata</strong> utiliza y protege la información procesada
            a través de la conexión con <strong>Uber Eats Marketplace</strong>.
          </p>

          <h2>1. Información que procesamos</h2>
          <p>
            El sistema puede procesar información necesaria para la operación e
            integración técnica con Uber Eats, incluyendo:
          </p>
          <ul>
            <li>Datos de autenticación e integración autorizados por Uber.</li>
            <li>Información de tiendas asociadas al merchant.</li>
            <li>Datos operativos de pedidos enviados por webhooks.</li>
            <li>Identificadores técnicos de tienda, marca e integración.</li>
            <li>Datos mínimos necesarios para validación, monitoreo y soporte.</li>
          </ul>

          <h2>2. Uso de la información</h2>
          <p>
            La información es utilizada exclusivamente para:
          </p>
          <ul>
            <li>Autenticar y enlazar la cuenta del merchant con Uber Eats.</li>
            <li>Consultar tiendas disponibles para activación.</li>
            <li>Activar la integración de tiendas con el sistema de caja.</li>
            <li>Recibir y procesar eventos de pedidos mediante webhooks.</li>
            <li>Dar seguimiento técnico, diagnóstico y soporte operativo.</li>
          </ul>

          <h2>3. Protección de datos</h2>
          <p>
            No vendemos información personal ni utilizamos los datos con fines
            ajenos a la operación e integración del sistema. El acceso a la
            información está restringido al personal autorizado y se aplica un uso
            limitado para fines técnicos, operativos y de soporte.
          </p>

          <h2>4. Conservación de la información</h2>
          <p>
            Los datos se conservan únicamente durante el tiempo necesario para la
            operación de la integración, la validación técnica, el cumplimiento de
            procesos internos y la atención de incidencias.
          </p>

          <h2>5. Terceros</h2>
          <p>
            Esta integración interactúa con los servicios de Uber Eats Marketplace.
            El tratamiento de datos relacionado con la plataforma de Uber también
            puede estar sujeto a las políticas y términos aplicables de Uber.
          </p>

          <h2>6. Contacto</h2>
          <p>
            Para dudas relacionadas con privacidad, soporte técnico o esta
            integración, puedes contactar a:
            <strong>castanedalopezana@yahoo.com</strong>
          </p>
        </div>
      </body>
    </html>
  `);
}