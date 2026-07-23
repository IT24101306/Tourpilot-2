declare module "nodemailer" {
  export type TransportOptions = {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: { user: string; pass: string };
    connectionTimeout?: number;
    greetingTimeout?: number;
    socketTimeout?: number;
  };

  export type SendMailOptions = {
    from?: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
  };

  export interface Transporter {
    sendMail(options: SendMailOptions): Promise<unknown>;
    verify(): Promise<true>;
  }

  export function createTransport(options: TransportOptions): Transporter;

  const nodemailer: {
    createTransport: typeof createTransport;
  };

  export default nodemailer;
}
