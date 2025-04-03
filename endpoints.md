Aquí tienes la documentación completa de los endpoints que tu frontend debe consumir, incluyendo métodos, parámetros, cuerpos de solicitud y respuestas esperadas:

---

### **📌 Endpoints Base**
- **URL Base:** `http://localhost:3000/api` (o tu dominio en producción)
- **Content-Type:** `application/json` (excepto para uploads)

---

### **1. Health Check 🩺**
Verifica el estado del servidor.

| Método | Endpoint       | Descripción               |
|--------|----------------|---------------------------|
| `GET`  | `/health`      | Verifica salud del API    |

**Respuesta Exitosa (200):**
```json
{
  "status": "OK",
  "timestamp": "2025-04-05T12:00:00.000Z",
  "service": "Inventory Prediction API",
  "version": "1.0.0"
}
```

---

### **2. Predicciones 📊**

#### **Obtener todas las predicciones**
| Método | Endpoint              | Descripción                     |
|--------|-----------------------|---------------------------------|
| `GET`  | `/predictions`        | Lista completa de predicciones  |

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "codigo": "ART-001",
      "descripcion": "Producto 1",
      "stock_actual": 150,
      "prediccion": [
        {
          "mes": "Mar-2025",
          "stock_proyectado": 135,
          "alerta_stock": true
        }
      ]
    }
  ],
  "metadata": {
    "count": 25,
    "generated_at": "2025-04-05T12:00:00.000Z"
  }
}
```

#### **Obtener predicción por código**
| Método | Endpoint                   | Descripción                     |
|--------|----------------------------|---------------------------------|
| `GET`  | `/predictions/:codigo`     | Predicción para un producto     |

**Parámetro:**
- `:codigo`: Código del producto (ej: `ART-001`)

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "metadata": {
      "codigo": "ART-001",
      "last_updated": "2025-04-05T12:00:00.000Z"
    },
    "datos_generales": {
      "descripcion": "Producto 1",
      "stock_actual": 150
    },
    "proyecciones": [
      {
        "periodo": "Mar-2025",
        "stock_proyectado": 135,
        "alerta": true
      }
    ]
  }
}
```

**Error (404):**
```json
{
  "success": false,
  "error": "Producto no encontrado",
  "code": "PRODUCT_NOT_FOUND"
}
```

---

### **3. Actualización de Datos 🔄**

#### **Subir archivo Excel**
| Método | Endpoint               | Descripción                     |
|--------|------------------------|---------------------------------|
| `POST` | `/predictions/refresh` | Sube nuevo Excel para predicciones |

**Headers:**
```
Content-Type: multipart/form-data
```

**Body:**
- Campo `file`: Archivo Excel (.xlsx, .xls)

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "message": "Predicciones actualizadas correctamente",
  "data": {
    "processed_file": "inventario.xlsx",
    "products_updated": 42,
    "generated_at": "2025-04-05T12:05:00.000Z"
  }
}
```

**Errores Comunes:**
| Código | Error                      | Causa                           |
|--------|----------------------------|---------------------------------|
| `400`  | `NO_FILE_UPLOADED`         | No se envió archivo             |
| `400`  | `INVALID_FILE_TYPE`        | Archivo no es Excel             |
| `413`  | `FILE_TOO_LARGE`           | Archivo > 10MB                  |
| `422`  | `FILE_PROCESSING_ERROR`    | Error al procesar el Excel      |

---

### **4. Errores Comunes ⚠️**
Todas las respuestas de error siguen este formato:
```json
{
  "success": false,
  "error": "Mensaje descriptivo",
  "code": "CODIGO_DEL_ERROR",
  "details": "Info adicional (solo en desarrollo)"
}
```

**Códigos importantes:**
- `401` UNAUTHORIZED
- `404` NOT_FOUND
- `429` TOO_MANY_REQUESTS
- `500` INTERNAL_SERVER_ERROR

---

### **📋 Ejemplo de Uso en Frontend (React)**
```javascript
// Obtener todas las predicciones
const fetchPredictions = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/predictions');
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error('Error:', error.message);
    return [];
  }
};

// Subir archivo Excel
const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('excel', file);

  const response = await fetch('http://localhost:3000/api/predictions/refresh', {
    method: 'POST',
    body: formData
  });
  return await response.json();
};
```

---

### **🔗 Estructura Recomendada para Frontend**
1. **Services API**:
   ```javascript
   // src/services/api.js
   const API_BASE = 'http://localhost:3000/api';

   export const getPredictions = () => fetch(`${API_BASE}/predictions`);
   export const uploadExcel = (file) => { /* ... */ };
   ```

2. **Manejo de Errores**:
   - Verificar `response.ok`
   - Leer `error.code` para lógica específica

3. **Variables de Entorno**:
   ```env
   VITE_API_URL=http://localhost:3000/api
   ```

---

### **📌 Notas para el Equipo Frontend**
1. Todos los endpoints requieren autenticación (si la hay) via `Authorization: Bearer <token>`
2. Para uploads usar `Content-Type: multipart/form-data`
3. El campo para subir archivos debe llamarse `excel`
4. Los códigos de producto son sensibles a mayúsculas/minúsculas

¿Necesitas que desarrolle algún componente frontend específico para consumir estos endpoints? 😊