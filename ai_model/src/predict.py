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

# Configuración de argumentos
parser = argparse.ArgumentParser(description='Generar predicciones de inventario')
parser.add_argument('--excel', type=str, 
                   default=os.path.join(os.path.dirname(__file__), '../data/PRUEBA PASANTIAS EPN.xlsx'),
                   help='Ruta al archivo Excel de entrada')
parser.add_argument('--model', type=str,
                   default=os.path.join(os.path.dirname(__file__), '../models/prophet_model.pkl.gz'),
                   help='Ruta al modelo Prophet comprimido')
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
            logging.FileHandler('prediction_log.txt', encoding='utf-8'),
            logging.StreamHandler(sys.stdout)
        ]
    )
    return logging.getLogger()

logger = setup_logging()

def cargar_datos():
    """Carga y valida el archivo Excel."""
    try:
        logger.info(f"Cargando archivo: {os.path.abspath(args.excel)}")
        
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
        logger.info(f"Cargando modelo Prophet: {os.path.abspath(args.model)}")
        
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
            
            for mes in range(1, 7):  # 6 meses de proyección
                fecha = datetime(2025, 3, 1) + timedelta(days=mes * 30)
                
                # Determinar consumo mensual usando Prophet si está disponible
                if prophet_predictions and row["CODIGO"] in prophet_predictions:
                    # Obtener predicción de Prophet para este mes
                    pred_date = datetime(2025, 2 + mes, 15)
                    prophet_pred = next((p for p in prophet_predictions[row["CODIGO"]] 
                                        if pd.Timestamp(p['ds']).month == pred_date.month 
                                        and pd.Timestamp(p['ds']).year == pred_date.year), None)
                    
                    if prophet_pred:
                        # Usar predicción de Prophet
                        consumo = max(prophet_pred['yhat'], 0)
                    else:
                        # Método convencional con factor de crecimiento
                        consumo = row["PROM CONS+Proyec"] * (1.02 ** mes)
                else:
                    # Método convencional con factor de crecimiento
                    consumo = row["PROM CONS+Proyec"] * (1.02 ** mes)
                
                diario = consumo / 22
                
                # Cálculo dual
                stock_minimo = consumo + (diario * 19)
                punto_reorden = diario * 44
                
                stock_proyectado = max(stock_actual - consumo, 0)
                necesita_pedir = max(punto_reorden - stock_proyectado, 0)
                cajas_a_pedir = int(np.ceil(necesita_pedir / row["UNID/CAJA"]))
                unidades_a_pedir = cajas_a_pedir * row["UNID/CAJA"]
                
                info_mes = {
                    "mes": f"{SPANISH_MONTHS[fecha.month]}-{fecha.year}",
                    "stock_actual": round(stock_proyectado, 2),
                    "consumo_mensual": round(consumo, 2),
                    "consumo_diario": round(diario, 2),
                    "stock_seguridad": round(diario * 19, 2),
                    "stock_minimo": round(stock_minimo, 2),
                    "punto_reorden": round(punto_reorden, 2),
                    "deficit": round(necesita_pedir, 2),
                    "cajas_a_pedir": cajas_a_pedir,
                    "unidades_a_pedir": round(unidades_a_pedir, 2),
                    "alerta_stock": bool(stock_proyectado < punto_reorden)
                }
                
                proyecciones.append(info_mes)
                stock_actual = stock_proyectado
            
            # Obtener datos históricos de consumo de todas las columnas disponibles
            consumos_historicos = {}
            
            # Recorrer todas las columnas que empiezan con "CONS"
            for col in df.columns:
                if col.startswith("CONS "):
                    # Extraer mes y año del nombre de la columna
                    parts = col.split()
                    if len(parts) >= 3:
                        mes = parts[1]
                        año = parts[2]
                        # Convertir a formato consistente
                        key = f"CONS_{mes}_{año}"
                        consumos_historicos[key] = float(row.get(col, 0))
            
            # Información del producto
            producto_info = {
                "CODIGO": str(row["CODIGO"]),
                "DESCRIPCION": str(row["DESCRIPCION"]),
                "UNID_POR_CAJA": float(row["UNID/CAJA"]),
                "STOCK_ACTUAL": float(row["STOCK  TOTAL"]),
                "CONSUMO_PROMEDIO": float(row["PROM CONSU"]),
                "PROYECCION_CONSUMO": float(row["Proyec de  Conss"]),
                "CONSUMO_TOTAL_PROYECTADO": float(row["PROM CONS+Proyec"]),
                "CONSUMO_DIARIO": float(row["DIARIO"]),
                "STOCK_SEGURIDAD": float(row["SS"]),
                "STOCK_MINIMO": float(row["STOCK MINIMO (Prom + SS)"]),
                "PUNTO_REORDEN": float(row["PUNTO DE REORDEN (44 días)"]),
                "DEFICIT_ACTUAL": float(row["DEFICIT"]),
                "CAJAS_NECESARIAS": float(row["CAJAS NECESARIAS"]),
                "CAJAS_A_PEDIR": int(row["CAJAS A PEDIR"]),
                "UNIDADES_A_PEDIR": float(row["UNIDADES A PEDIR"]),
                "CONSUMOS_HISTORICOS": consumos_historicos,  # Ahora incluye todos los consumos disponibles
                "PREDICCION": proyecciones
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
        output_dir = os.path.join(os.path.dirname(__file__), '../data')
        os.makedirs(output_dir, exist_ok=True)
        
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
        output_path = os.path.join(output_dir, 'predicciones_completas.json')
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(resultados_validados, f, indent=4, ensure_ascii=False)
            
        logger.info(f"Resultados guardados exitosamente en {output_path}")
        
        # Guardar como JSON minificado también (más eficiente para procesamiento)
        output_path_min = os.path.join(output_dir, 'predicciones_completas.min.json')
        with open(output_path_min, 'w', encoding='utf-8') as f:
            json.dump(resultados_validados, f, ensure_ascii=False)
            
        logger.info(f"Resultados guardados en formato minificado en {output_path_min}")
        
    except Exception as e:
        logger.error(f"Error al guardar: {str(e)}")
        sys.exit(1)

def main():
    try:
        logger.info("=== INICIO DEL PROCESO ===")
        
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