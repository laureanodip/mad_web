// app.js completo actualizado con filtro de rubros desde la tabla correcta
const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();

// 🔧 Conexión a MySQL en Railway (NO usar localhost en Render)
const db = mysql.createConnection({
  host: 'shortline.proxy.rlwy.net',
  user: 'root',
  password: 'mwNDkiWIFiTAtSqYhFTpWEIwZfnZkpYT',
  database: 'railway',
  port: 22722
});

db.connect(err => {
  if (err) {
    console.error('❌ Error al conectar a MySQL:', err.message);
    process.exit(1); // Detiene el servidor si falla la conexión
  }
  console.log('✅ Conectado a MySQL');
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname.startsWith('imagen_producto')) {
      cb(null, 'public/uploads/productos');
    } else {
      cb(null, 'public/uploads/variables');
    }
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

app.get('/api/catalogo', (req, res) => {
  const offset = parseInt(req.query.offset) || 0;
  const limit = parseInt(req.query.limit) || 20;
  const categoria = req.query.categoria || '';
  const color = req.query.color || '';
  const talle = req.query.talle || '';
  const tipo = req.query.tipo || '';

  let sql = `
    SELECT p.id, p.nombre, p.imagen_producto
    FROM productos p
    LEFT JOIN rubros r ON p.rubro_id = r.id
    LEFT JOIN subrubros s ON p.subrubro_id = s.id
    WHERE 1=1
  `;

  const params = [];

  if (categoria) {
    sql += ' AND r.nombre = ?';
    params.push(categoria);
  }

  sql += ' LIMIT ?, ?';
  params.push(offset, limit);

  db.query(sql, params, async (err, productos) => {
    if (err) return res.status(500).json({ error: err });

    const final = await Promise.all(productos.map(p => {
      return new Promise((resolve, reject) => {
        let varSQL = `SELECT * FROM variables WHERE producto_id = ?`;
        const varParams = [p.id];

        if (color) {
          varSQL += ' AND color = ?';
          varParams.push(color);
        }
        if (talle) {
          varSQL += ' AND talle = ?';
          varParams.push(talle);
        }
        if (tipo) {
          varSQL += ' AND tipo = ?';
          varParams.push(tipo);
        }

        db.query(varSQL, varParams, (err, variables) => {
          if (err) return reject(err);
          p.variables = variables;
          resolve(p);
        });
      });
    }));

    const filtrados = final.filter(p => p.variables.length > 0);
    res.json(filtrados);
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// ==========================================
// 🔹 API PARA CARGAR FILTROS
// ==========================================
app.get('/api/filtros', (req, res) => {
  const resultados = {};

  db.query('SELECT DISTINCT r.nombre AS rubro FROM productos p LEFT JOIN rubros r ON p.rubro_id = r.id WHERE r.nombre IS NOT NULL', (err, rows1) => {
    if (err) return res.status(500).json({ error: err });
    resultados.categorias = rows1.map(r => r.rubro);

    db.query('SELECT DISTINCT color FROM variables WHERE color IS NOT NULL', (err, rows2) => {
      if (err) return res.status(500).json({ error: err });
      resultados.colores = rows2.map(r => r.color);

      db.query('SELECT DISTINCT talle FROM variables WHERE talle IS NOT NULL', (err, rows3) => {
        if (err) return res.status(500).json({ error: err });
        resultados.talles = rows3.map(r => r.talle);

        db.query('SELECT DISTINCT tipo FROM variables WHERE tipo IS NOT NULL', (err, rows4) => {
          if (err) return res.status(500).json({ error: err });
          resultados.tipos = rows4.map(r => r.tipo);

          res.json(resultados);
        });
      });
    });
  });
});

// ✅ Adaptado para Render (usa el puerto asignado por el sistema)
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en puerto ${port}`);
});

