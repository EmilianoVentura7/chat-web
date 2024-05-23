import express, { Request, Response } from 'express';
import cors from 'cors';
import mysql from 'mysql2';
import http from 'http';
import WebSocket from 'ws';

const app = express();
const httpServer = http.createServer(app);

app.use(cors());
app.use(express.json());

interface Mensaje {
  user: string;
  asunto: string;
  fecha: string;
}

interface EstadisticaMensaje {
  user: string;
  mensajesEnviados: number;
}

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'ventura571',
  database: 'cs'
});

connection.connect(err => {
  if (err) {
    console.error('Error de conexión a la base de datos:', err);
    return;
  }
  console.log('Conexión a la base de datos establecida');
});

app.post('/mensajes', (req: Request, res: Response) => {
  const mensaje: Mensaje = {
    user: req.body.user,
    asunto: req.body.asunto,
    fecha: new Date().toISOString().slice(0, 19).replace('T', ' ')
  };
  
  connection.query('INSERT INTO mensajes SET ?', mensaje, (error, results) => {
    if (error) {
      console.error('Error al insertar mensaje:', error);
      return res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
    enviarEstadisticasMensajes();
    return res.status(200).json({ success: true });
  });
});

app.get('/mensajes', (req: Request, res: Response) => {
  connection.query('SELECT * FROM mensajes', (error, results) => {
    if (error) {
      console.error('Error al obtener mensajes:', error);
      return res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
    return res.status(200).json({ success: true, mensajes: results });
  });
});

app.get('/mensajes/update', (req: Request, res: Response) => {
  const ultimoMensaje = parseInt(req.query.idMensaje as string, 10);
  connection.query('SELECT * FROM mensajes WHERE id > ?', [ultimoMensaje], (error, results) => {
    if (error) {
      console.error('Error al obtener mensajes actualizados:', error);
      return res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
    return res.status(200).json({ success: true, mensajes: results });
  });
});

app.get('/mensajes/estadisticas', (req: Request, res: Response) => {
  connection.query('SELECT user, COUNT(*) as mensajesEnviados FROM mensajes GROUP BY user', (error, results) => {
    if (error) {
      console.error('Error al obtener estadísticas de mensajes:', error);
      return res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
    return res.status(200).json({ success: true, datosUsuarios: results });
  });
});

const wss = new WebSocket.Server({ server: httpServer });

function enviarEstadisticasMensajes() {
  connection.query('SELECT user, COUNT(*) as mensajesEnviados FROM mensajes GROUP BY user', (error, results) => {
    if (error) {
      console.error('Error al obtener estadísticas de mensajes:', error);
      return;
    }
    const message = JSON.stringify({ type: 'estadisticasMensajes', data: results });
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
}

wss.on('connection', (ws: WebSocket) => {
  console.log('Cliente conectado');

  ws.on('message', (message: string) => {
    const data = JSON.parse(message);
  });

  ws.on('close', () => {
    console.log('Cliente desconectado');
  });
});

httpServer.listen(3000, () => {
  console.log('Servidor inicializado en el puerto 3000');
  enviarEstadisticasMensajes();
});
