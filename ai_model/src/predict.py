import json
import sys
import os
import argparse
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import locale
import logging
import gzip
import pickle
from sklearn.metrics import mean_absolute_percentage_error

# Configuración regional
try:
    locale.setlocale(locale.LC_ALL, 'en_US.UTF-8')
except:
    locale.setlocale(locale.LC_ALL, '')

# Configuración de rutas base
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
MODELS_DIR = os.path.join(BASE_DIR, 'models')
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

# Configuración de argumentos
parser = argparse.ArgumentParser(description='Generar predicciones de inventario')
parser.add_argument('--excel', type=str, 
                   help='Ruta al archivo Excel de entrada')
parser.add_argument('--model', type=str,
                   default=os.path.join(MODELS_DIR, 'prophet_model.pkl.gz'),
                   help='Ruta al modelo Prophet comprimido')
parser.add_argument('--transito', type=float, default=0.0,
                   help='Unidades en tránsito disponibles para asignación')
args = parser.parse_args()


# Diccionario de meses en español
SPANISH_MONTHS = {
    1: "Ene", 2: "Feb", 3: "Mar", 4: "Abr", 
    5: "May", 6: "Jun", 7: "Jul", 8: "Ago",
    9: "Sep", 10: "Oct", 11: "Nov", 12: "Dic"
}

def setup_logging():
    """Configura el sistema de logging"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(os.path.join(BASE_DIR, 'prediction_log.txt'), encoding='utf-8'),
            logging.StreamHandler(sys.stdout)
        ]
    )
    return logging.getLogger()

logger = setup_logging()

def cargar_datos():
    """Carga y valida el archivo Excel."""
    try:
        logger.info(f"Cargando archivo: {args.excel}")
        
        if not os.path.exists(args.excel):
            raise FileNotFoundError(f"Archivo no encontrado: {args.excel}")
        
        df = pd.read_excel(args.excel, skiprows=2)
        logger.info("Archivo leído correctamente")
        
        # Limpieza de columnas
        df.columns = [col.strip().replace("\n", " ") for col in df.columns]
        cols_to_drop = [col for col in df.columns if "Unnamed" in col]
        if cols_to_drop:
            df = df.drop(columns=cols_to_drop)
        
        # Validación de columnas
        required_columns = [
            "CODIGO", "DESCRIPCION", "UNID/CAJA", "STOCK  TOTAL",
            "CONS ENE 2024", "CONS FEB 2024", "CONS MAR 2024",
            "CONS ABR 2024", "CONS MAY 2024", "CONS JUN 2024",
            "CONS JUL 2024", "CONS AGO 2024", "CONS SEP 2024",
            "CONS OCT 2024", "CONS NOV 2024", "CONS DIC 2024",
            "CONS ENE 2025", "CONS FEB 2025"
        ]
        
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            raise ValueError(f"Columnas faltantes: {missing_cols}")
        
        # Rellenar valores nulos en columnas de texto
        text_columns = ["CODIGO", "DESCRIPCION"]
        for col in text_columns:
            if col in df.columns:
                df[col] = df[col].fillna("Sin información")

        return df

    except Exception as e:
        logger.error(f"Error en carga de datos: {str(e)}")
        sys.exit(1)

def cargar_modelo_prophet():
    """Carga el modelo Prophet desde el archivo comprimido."""
    try:
        logger.info(f"Cargando modelo Prophet: {args.model}")
        
        if not os.path.exists(args.model):
            raise FileNotFoundError(f"Modelo no encontrado: {args.model}")
        
        with gzip.open(args.model, 'rb') as f:
            prophet_model = pickle.load(f)
        
        logger.info("Modelo Prophet cargado correctamente")
        return prophet_model
    
    except Exception as e:
        logger.error(f"Error al cargar modelo Prophet: {str(e)}")
        logger.warning("Continuando sin modelo Prophet, usando método estadístico alternativo")
        return None

def preparar_datos_prophet(df):
    """Prepara los datos para su uso con Prophet."""
    prophet_data = {}
    
    for _, row in df.iterrows():
        if not isinstance(row["CODIGO"], str) or row["CODIGO"] == "Sin información":
            continue
            
        # Crear serie temporal con datos históricos
        dates = []
        values = []
        
        # Consumos 2024
        for month in range(1, 13):
            col_name = f"CONS {SPANISH_MONTHS[month]} 2024"
            if col_name in df.columns:
                dates.append(pd.Timestamp(2024, month, 15))
                values.append(row.get(col_name, 0))
        
        # Consumos 2025 disponibles
        for month in range(1, 3):
            col_name = f"CONS {SPANISH_MONTHS[month]} 2025"
            if col_name in df.columns:
                dates.append(pd.Timestamp(2025, month, 15))
                values.append(row.get(col_name, 0))
                
        # Crear DataFrame para Prophet
        if dates and values:
            ts_df = pd.DataFrame({
                'ds': dates,
                'y': values
            })
            prophet_data[row["CODIGO"]] = ts_df
    
    return prophet_data

def predecir_con_prophet(prophet_model, prophet_data):
    """Realiza predicciones usando el modelo Prophet cargado."""
    resultados = {}
    mape_total = 0
    count = 0
    
    for codigo, ts_df in prophet_data.items():
        try:
            # Crear periodo de predicción (6 meses desde marzo 2025)
            future = pd.DataFrame({
                'ds': [datetime(2025, 3+i, 15) for i in range(6)]
            })
            
            # Realizar predicción
            forecast = prophet_model.predict(future)
            
            # Calcular MAPE en datos históricos
            if len(ts_df) >= 3:  # Al menos 3 puntos para evaluar
                train_size = len(ts_df) - 2
                train = ts_df.iloc[:train_size]
                test = ts_df.iloc[train_size:]
                
                # Predecir en el conjunto de prueba
                future_test = pd.DataFrame({'ds': test['ds']})
                forecast_test = prophet_model.predict(future_test)
                
                # Calcular MAPE
                mape = mean_absolute_percentage_error(test['y'], forecast_test['yhat'])
                mape_total += mape
                count += 1
                
                # Verificar si el error es menor al 5%
                if mape > 0.05:
                    logger.warning(f"Error MAPE para {codigo} es {mape:.2%}, superior al 5% permitido")
            
            # Guardar resultados
            resultados[codigo] = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].to_dict('records')
            
        except Exception as e:
            logger.error(f"Error al predecir con Prophet para {codigo}: {str(e)}")
    
    # Calcular MAPE promedio
    if count > 0:
        mape_promedio = mape_total / count
        logger.info(f"MAPE promedio: {mape_promedio:.2%}")
        if mape_promedio <= 0.05:
            logger.info("La precisión cumple con el requisito de error menor al 5%")
        else:
            logger.warning("La precisión NO cumple con el requisito de error menor al 5%")
    
    return resultados

def calcular_predicciones(df, prophet_predictions=None):
    """Calcula las predicciones con ambos métodos."""
    try:
        logger.info("Calculando predicciones...")
        
        # Conversión a numérico
        numeric_cols = [col for col in df.columns[2:] if col not in ["CODIGO", "DESCRIPCION"]]
        df[numeric_cols] = df[numeric_cols].apply(pd.to_numeric, errors='coerce').fillna(0)
        df["UNID/CAJA"] = df["UNID/CAJA"].replace(0, 1)

        # Cálculos base
        df["PROM CONSU"] = df.iloc[:, 4:18].mean(axis=1)
        df["Proyec de  Conss"] = pd.to_numeric(df.get("Proyec de  Conss", 0), errors='coerce').fillna(0)
        df["PROM CONS+Proyec"] = df["PROM CONSU"] + df["Proyec de  Conss"]
        df["DIARIO"] = df["PROM CONS+Proyec"] / 22
        df["SS"] = df["DIARIO"] * 19  # Stock de seguridad (19 días)
        
        # DIFERENCIACIÓN CLAVE: Ambos métodos de cálculo
        df["STOCK MINIMO (Prom + SS)"] = df["PROM CONS+Proyec"] + df["SS"]  # Método tradicional
        df["PUNTO DE REORDEN (44 días)"] = df["DIARIO"] * 44  # Nuevo método
        
        # Cálculo de pedidos usando PUNTO DE REORDEN (44 días)
        df["DEFICIT"] = np.maximum(df["PUNTO DE REORDEN (44 días)"] - df["STOCK  TOTAL"], 0)
        df["CAJAS NECESARIAS"] = df["DEFICIT"] / df["UNID/CAJA"]
        df["CAJAS A PEDIR"] = np.ceil(df["CAJAS NECESARIAS"]).astype(int)
        df["UNIDADES A PEDIR"] = df["CAJAS A PEDIR"] * df["UNID/CAJA"]
        
        # Generar predicciones mensuales
        resultados_completos = []
        
        for _, row in df.iterrows():
            if not isinstance(row["CODIGO"], str) or row["CODIGO"] == "Sin información":
                continue
                
            proyecciones = []
            stock_actual = row["STOCK  TOTAL"]
            
            # Cálculo de fecha de reposición (modificado según solicitud)
            lead_time_days = 15  # Tiempo de entrega en días
            fecha_actual = datetime(2025, 3, 1)
            max_dias_reposicion = 30  # Nuevo parámetro: máximo días para reposición
            
            if row["DIARIO"] > 0:
                # Cálculo de días hasta punto de reorden
                dias_hasta_reorden = max((row["PUNTO DE REORDEN (44 días)"] - row["STOCK  TOTAL"]) / row["DIARIO"], 0)
                
                # Aplicar límite máximo
                dias_hasta_reorden = min(dias_hasta_reorden, max_dias_reposicion)
                
                # Fecha de reposición considerando lead time
                fecha_reposicion = fecha_actual + timedelta(days=max(dias_hasta_reorden - lead_time_days, 0))
                fecha_reposicion_str = fecha_reposicion.strftime("%Y-%m-%d")
                
                # Cálculo de tiempo de cobertura inicial (días de stock actual)
                tiempo_cobertura = min(row["STOCK  TOTAL"] / row["DIARIO"], max_dias_reposicion)
                
                # Frecuencia sugerida de reposición (basada en consumo histórico)
                frecuencia_reposicion = min(row["PUNTO DE REORDEN (44 días)"] / row["DIARIO"], max_dias_reposicion)
            else:
                fecha_reposicion_str = "No aplica"
                tiempo_cobertura = 0
                frecuencia_reposicion = 0
            
            for mes in range(1, 7):  # 6 meses de proyección
                fecha = datetime(2025, 3, 1) + timedelta(days=mes * 30)
                
                # Determinar consumo mensual usando Prophet si está disponible
                if prophet_predictions and row["CODIGO"] in prophet_predictions:
                    pred_date = datetime(2025, 2 + mes, 15)
                    prophet_pred = next((p for p in prophet_predictions[row["CODIGO"]] 
                                      if pd.Timestamp(p['ds']).month == pred_date.month 
                                      and pd.Timestamp(p['ds']).year == pred_date.year), None)
                    
                    consumo = max(prophet_pred['yhat'], 0) if prophet_pred else row["PROM CONS+Proyec"] * (1.02 ** mes)
                else:
                    consumo = row["PROM CONS+Proyec"] * (1.02 ** mes)
                
                diario = consumo / 22
                ss_mes = diario * 19
                stock_minimo = consumo + (diario * 19)
                punto_reorden_mes = diario * 44
                
                stock_despues_consumo = max(stock_actual - consumo, 0)
                deficit = max(punto_reorden_mes - stock_despues_consumo, 0)
                cajas_pedir = int(np.ceil(deficit / row["UNID/CAJA"]))
                unidades_pedir = cajas_pedir * row["UNID/CAJA"]
                stock_proyectado = stock_despues_consumo + unidades_pedir
                
                # Nuevos cálculos para este mes
                if diario > 0:
                    tiempo_cob_mes = min(
                        max(stock_proyectado - ss_mes, 0) / diario,  # Aseguramos no negativo
                        max_dias_reposicion
                    )
                    fecha_rep_mes = (fecha + timedelta(
                        days=max(tiempo_cob_mes - lead_time_days, 0)
                    )).strftime("%Y-%m-%d")
                    frecuencia_rep_mes = min(
                        punto_reorden_mes / diario,
                        max_dias_reposicion
                    )
                else:
                    fecha_rep_mes = "No aplica"
                    tiempo_cob_mes = 0
                    frecuencia_rep_mes = 0           
                
                info_mes = {
                    "mes": f"{SPANISH_MONTHS[fecha.month]}-{fecha.year}",
                    "stock_proyectado": round(stock_proyectado, 2),
                    "consumo_mensual": round(consumo, 2),
                    "consumo_diario": round(diario, 2),
                    "stock_seguridad": round(diario * 19, 2),
                    "stock_minimo": round(stock_minimo, 2),
                    "punto_reorden": round(punto_reorden_mes, 2),
                    "deficit": round(deficit, 2),
                    "cajas_a_pedir": cajas_pedir,
                    "unidades_a_pedir": round(unidades_pedir, 2),
                    "alerta_stock": bool(stock_despues_consumo < punto_reorden_mes),
                    "fecha_reposicion": fecha_rep_mes,
                    "tiempo_cobertura": round(tiempo_cob_mes, 2),
                    "frecuencia_reposicion": round(frecuencia_rep_mes, 2)                    
                }
                
                proyecciones.append(info_mes)
                stock_actual = stock_proyectado
            
            # Obtener datos históricos de consumo
            consumos_historicos = {
                col.split()[1] + "_" + col.split()[2]: row[col]
                for col in df.columns if col.startswith("CONS ") and len(col.split()) >= 3
            }
            
            # Información del producto (manteniendo estructura original)
            producto_info = {
                # Identificación del producto
                "CODIGO": str(row["CODIGO"]),
                "DESCRIPCION": str(row["DESCRIPCION"]),
                
                # Unidades y stock
                "UNIDADES_POR_CAJA": float(row["UNID/CAJA"]),
                "STOCK_FISICO": float(row["STOCK  TOTAL"]),  # Stock físico real
                "UNIDADES_TRANSITO_DISPONIBLES": max(float(args.transito), 0),  # Nunca negativo
                "STOCK_TOTAL": float(row["STOCK  TOTAL"]),  # Stock físico + transito asignado
                
                # Cálculos de consumo
                "CONSUMO_PROMEDIO": float(row["PROM CONSU"]),
                "CONSUMO_PROYECTADO": float(row["Proyec de  Conss"]),
                "CONSUMO_TOTAL": float(row["PROM CONS+Proyec"]),
                "CONSUMO_DIARIO": float(row["DIARIO"]),
                
                # Puntos de reorden
                "STOCK_SEGURIDAD": float(row["SS"]),
                "STOCK_MINIMO": float(row["STOCK MINIMO (Prom + SS)"]),
                "PUNTO_REORDEN": float(row["PUNTO DE REORDEN (44 días)"]),
                
                # Indicadores actualizables
                "DEFICIT": max(float(row["PUNTO DE REORDEN (44 días)"]) - float(row["STOCK  TOTAL"]), 0),
                "CAJAS_A_PEDIR": int(np.ceil(max(float(row["PUNTO DE REORDEN (44 días)"]) - float(row["STOCK  TOTAL"]), 0) / float(row["UNID/CAJA"]))),
                "UNIDADES_A_PEDIR": int(np.ceil(max(float(row["PUNTO DE REORDEN (44 días)"]) - float(row["STOCK  TOTAL"]), 0) / float(row["UNID/CAJA"]))) * float(row["UNID/CAJA"]),
                "FECHA_REPOSICION": fecha_reposicion_str,
                "DIAS_COBERTURA": round(tiempo_cobertura, 2),
                
                # Datos históricos
                "HISTORICO_CONSUMOS": consumos_historicos,
                
                # Proyecciones futuras
                "PROYECCIONES": proyecciones,
                
                # Configuración para recálculos
                "CONFIGURACION": {
                    "DIAS_STOCK_SEGURIDAD": 19,
                    "DIAS_PUNTO_REORDEN": 44,
                    "LEAD_TIME_REPOSICION": 15,
                    "DIAS_MAX_REPOSICION": 30,
                    "DIAS_LABORALES_MES": 22
                }
            }
            
            resultados_completos.append(producto_info)

        return df, resultados_completos

    except Exception as e:
        logger.error(f"Error en cálculos: {str(e)}")
        sys.exit(1)

def es_nan(valor):
    """Verifica si un valor es NaN, None o una cadena vacía."""
    if valor is None:
        return True
    if isinstance(valor, float) and np.isnan(valor):
        return True
    if isinstance(valor, str) and valor.strip() == "":
        return True
    return False

def corregir_valores_nan(data):
    """Corrige valores NaN en el JSON para asegurar compatibilidad."""
    if isinstance(data, dict):
        result = {}
        for k, v in data.items():
            if es_nan(v):
                if k in ["CODIGO", "DESCRIPCION"]:
                    result[k] = "Sin información"
                elif isinstance(v, (int, float)) or k.startswith(("CONS_", "STOCK_", "PUNTO_", "DEFICIT", "CAJAS", "UNIDADES")):
                    result[k] = 0
                else:
                    result[k] = "Sin información"
            else:
                result[k] = corregir_valores_nan(v)
        return result
    elif isinstance(data, list):
        return [corregir_valores_nan(item) for item in data if item is not None]
    elif isinstance(data, float) and np.isnan(data):
        return 0
    else:
        return data

def guardar_resultados(resultados_completos):
    """Guarda los resultados en un único archivo JSON."""
    try:
        # Asegurar que el directorio data existe
        os.makedirs(DATA_DIR, exist_ok=True)
        
        # Validar y corregir valores NaN en los resultados
        resultados_validados = corregir_valores_nan(resultados_completos)
        
        # Verificar si hay algún valor NaN o None en el JSON final
        json_str = json.dumps(resultados_validados)
        if "NaN" in json_str or "null" in json_str or "None" in json_str:
            logger.warning("Todavía existen valores NaN o null en el JSON. Aplicando corrección adicional.")
            # Convertir a objeto Python y volver a validar
            obj = json.loads(json_str.replace("NaN", "0").replace("null", "0").replace("None", "\"Sin información\""))
            resultados_validados = corregir_valores_nan(obj)
            # Verificar de nuevo
            json_str = json.dumps(resultados_validados)
            if "NaN" in json_str or "null" in json_str or "None" in json_str:
                logger.error("No se pudieron corregir todos los valores nulos, se procederá a una limpieza más agresiva")
                json_str = json_str.replace("NaN", "0").replace("null", "0").replace("None", "\"Sin información\"")
                resultados_validados = json.loads(json_str)
        
        # Guardar en un único archivo JSON
        output_path = os.path.join(DATA_DIR, 'predicciones_completas.json')
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(resultados_validados, f, indent=4, ensure_ascii=False)
            
        logger.info(f"Resultados guardados exitosamente en {output_path}")
        
        # Guardar como JSON minificado también (más eficiente para procesamiento)
        output_path_min = os.path.join(DATA_DIR, 'predicciones_completas.min.json')
        with open(output_path_min, 'w', encoding='utf-8') as f:
            json.dump(resultados_validados, f, ensure_ascii=False)
            
        logger.info(f"Resultados guardados en formato minificado en {output_path_min}")
        
    except Exception as e:
        logger.error(f"Error al guardar: {str(e)}")
        sys.exit(1)

def main():
    try:
        logger.info("=== INICIO DEL PROCESO ===")
        logger.info(f"Directorio base: {BASE_DIR}")
        logger.info(f"Directorio de datos: {DATA_DIR}")
        logger.info(f"Directorio de modelos: {MODELS_DIR}")
        
        # Cargar datos
        df = cargar_datos()
        
        # Cargar modelo Prophet
        prophet_model = cargar_modelo_prophet()
        
        # Preparar datos para Prophet si el modelo está disponible
        prophet_predictions = None
        if prophet_model:
            prophet_data = preparar_datos_prophet(df)
            prophet_predictions = predecir_con_prophet(prophet_model, prophet_data)
        
        # Calcular predicciones
        _, resultados_completos = calcular_predicciones(df, prophet_predictions)
        
        # Guardar resultados
        guardar_resultados(resultados_completos)
        
        logger.info("=== PROCESO COMPLETADO ===")
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"Error general: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    main()