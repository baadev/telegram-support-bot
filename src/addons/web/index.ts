import fakectx from '../fakectx';
import {ticketHandler} from '../../text';
import cache from '../../cache';
import TelegramAddon from '../telegram';
import rateLimit from 'express-rate-limit';
import * as log from 'fancy-log'

/* include script
<script id="chatScript" src="localhost:8080/chat.js"></script>
*/
const init = function(bot: TelegramAddon) {
  // Enable web server with socketio
  if (cache.config.web_server) {
    // Set up rate limiter
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
    });

    const express = require('express');
    const http = require('http');
    const app = express();
    const port = cache.config.web_server_port;
    const server = http.createServer(app);

    const {Server} = require('socket.io');
    const io = new Server(server, {
      maxHttpBufferSize: 10_000,
    });
    cache.io = io;
    app.use(limiter);
    app.use((_req: any, res: any, next: any) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      next();
    });

    // app.get('/', (req, res) => {
    //   res.writeHead(200, {'Content-Type': 'text/html'});
    // });

    app.get('/', (_req: any, res: any) => {
      res.sendFile(__dirname + '/web/index.html');
    });

    app.get('/chat.js', (_req: any, res: any) => {
      res.sendFile(__dirname + '/web/chat.js');
    });

    io.on(
        'connection',
        (socket: {
        on: (arg0: string, arg1: any) => void;
        emit: (arg0: string, arg1: any) => void;
        id: string;
      }) => {
          socket.on('chat', (msg: string) => {
            const text = typeof msg === 'string' ? msg.trim() : '';
            if (!text || text.length > 2000) {
              socket.emit('chat_staff', 'Message must be between 1 and 2000 characters.');
              return;
            }
            socket.emit('chat_user', text);
            fakectx.message.from.id = 'WEB' + socket.id;
            fakectx.message.chat.id = 'WEB' + socket.id;
            fakectx.message.text = text;
            ticketHandler(bot, fakectx);
          });
          socket.on('disconnect', () => log.info('Disconnected'));
        },
    );

    server.listen(port, () => log.info(`Server started on port ${port}`));
  }
};

export {init};
