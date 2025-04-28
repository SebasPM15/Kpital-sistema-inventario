import json
import re
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
    1: "ENE", 2: "FEB", 3: "MAR", 4: "ABR", 
    5: "MAY", 6: "JUN", 7: "JUL", 8: "AGO",
    9: "SEP", 10: "OCT", 11: "NOV", 12: "DIC"
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

def identificar_columnas_consumo(df):
    """Identifica dinámicamente todas las columnas de consumo disponibles en el DataFrame."""
    # Lista directa para las columnas de consumo
    cols_consumo = [col for col in df.columns if col.startswith("CONS ")]
    
    logger.info(f"Columnas que comienzan con 'CONS ' encontradas: {cols_consumo}")
    
    if not cols_consumo:
        raise ValueError("No se encontraron columnas de consumo en el archivo")
    
    # Organizar columnas por fecha para determinar orden cronológico
    fechas_consumo = []
    for col in cols_consumo:
        try:
            # Extraer los componentes de la columna (ejemplo: "CONS ENE 2024")
            partes = col.split()
            if len(partes) >= 3:
                mes_abr = partes[1]  # "ENE", "FEB", etc.
                año = int(partes[2])  # "2024", "2025", etc.
                
                # Convertir abreviatura de mes a número
                mes_num = None
                for num, abr in SPANISH_MONTHS.items():
                    if abr.upper() == mes_abr.upper():
                        mes_num = num
                        break
                
                if mes_num:
                    fecha = datetime(año, mes_num, 1)
                    fechas_consumo.append((col, fecha))
                    logger.debug(f"Columna {col} mapeada a {fecha}")
                else:
                    logger.warning(f"No se pudo identificar el mes para columna: {col}")
        except Exception as e:
            logger.warning(f"Error al procesar columna {col}: {str(e)}")
    
    # Ordenar por fecha
    fechas_consumo.sort(key=lambda x: x[1])
    
    cols_ordenadas = [item[0] for item in fechas_consumo]
    ultima_fecha = fechas_consumo[-1][1] if fechas_consumo else None
    
    logger.info(f"Columnas ordenadas: {cols_ordenadas}")
    if ultima_fecha:
        logger.info(f"Última fecha detectada: {ultima_fecha.strftime('%Y-%m-%d')}")
    else:
        logger.warning("No se pudo determinar la última fecha")
    
    return cols_ordenadas, ultima_fecha

def identificar_columnas_pedidos(df):
    """Identifica dinámicamente todas las columnas relacionadas con pedidos (POs) en el DataFrame."""
    patrones_po = {
        "STOCK_ANTES_ARRIBO": r"STOCK HASTA ANTES DEL ARRIBO DEL PROXIMO PO\s*(.*)",
        "A_PEDIR": r"A PEDIR UNID PO\s*(.*)",
        "STOCK_INCLUYENDO": r"STOCK INCLUYENDO PO\s*(.*)",
        "CONSUMO_PROYECTADO": r"CONSUMO PROYECTADO HASTA ANTES DEL ARRIBO DEL PROX PO\s*(.*)"
    }
    
    cols_pedidos = {}
    
    for col in df.columns:
        for tipo, patron in patrones_po.items():
            match = re.match(patron, col)
            if match:
                po_num = match.group(1).strip()
                if not po_num:
                    po_num = "GENERAL"
                
                if po_num not in cols_pedidos:
                    cols_pedidos[po_num] = {}
                
                cols_pedidos[po_num][tipo] = col
                logger.debug(f"Columna {col} identificada como {tipo} para PO {po_num}")
    
    logger.info(f"Columnas de pedidos identificadas: {json.dumps(cols_pedidos, indent=2)}")
    return cols_pedidos

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
        logger.info(f"Columnas después de limpieza: {list(df.columns)}")
        
        cols_to_drop = [col for col in df.columns if "Unnamed" in col]
        if cols_to_drop:
            df = df.drop(columns=cols_to_drop)
            logger.info(f"Columnas después de eliminar Unnamed: {list(df.columns)}")
        
        # Identificar columnas de consumo dinámicamente
        cols_consumo, ultima_fecha = identificar_columnas_consumo(df)
        
        # Validación de columnas básicas
        columnas_basicas = ["CODIGO", "DESCRIPCION", "UNID/CAJA", "STOCK  TOTAL"]
        missing_cols = [col for col in columnas_basicas if col not in df.columns]
        if missing_cols:
            raise ValueError(f"Columnas básicas faltantes: {missing_cols}")
        
        # Rellenar valores nulos
        text_columns = ["CODIGO", "DESCRIPCION"]
        for col in text_columns:
            if col in df.columns:
                df[col] = df[col].fillna("Sin información")

        # Identificar columnas de pedidos dinámicamente
        cols_pedidos = identificar_columnas_pedidos(df)
    
        return df, cols_consumo, ultima_fecha, cols_pedidos

    except Exception as e:
        logger.error(f"Error en carga de datos: {str(e)}")
        import traceback
        logger.error(f"Detalles del error: {traceback.format_exc()}")
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

def preparar_datos_prophet(df, cols_consumo):
    """Prepara los datos para su uso con Prophet."""
    prophet_data = {}
    
    for _, row in df.iterrows():
        if not isinstance(row["CODIGO"], str) or row["CODIGO"] == "Sin información":
            continue
            
        # Crear serie temporal con datos históricos
        dates = []
        values = []
        
        # Procesar todas las columnas de consumo identificadas
        for col in cols_consumo:
            partes = col.split()
            if len(partes) >= 3:
                mes_abr = partes[1]
                año = int(partes[2])
                
                # Convertir abreviatura de mes a número
                for num, abr in SPANISH_MONTHS.items():
                    if abr == mes_abr:
                        mes_num = num
                        break
                else:
                    continue
                
                dates.append(pd.Timestamp(año, mes_num, 15))
                values.append(row.get(col, 0))
                
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

def calcular_predicciones(df, cols_consumo, ultima_fecha, cols_pedidos, prophet_predictions=None):
    """Calcula las predicciones considerando correctamente los POs en tránsito."""
    try:
        logger.info("Calculando predicciones corregidas...")
        
        # Convertir columnas numéricas y manejar valores nulos
        numeric_cols = [col for col in df.columns[2:] if col not in ["CODIGO", "DESCRIPCION"]]
        df[numeric_cols] = df[numeric_cols].apply(pd.to_numeric, errors='coerce').fillna(0)
        df["UNID/CAJA"] = df["UNID/CAJA"].replace(0, 1)

        # Cálculos base
        df["PROM CONSU"] = df[cols_consumo].mean(axis=1)
        df["Proyec de  Conss"] = pd.to_numeric(df.get("Proyec de  Conss", 0), errors='coerce').fillna(0)
        df["PROM CONS+Proyec"] = df["PROM CONSU"] + df["Proyec de  Conss"]
        df["DIARIO"] = df["PROM CONS+Proyec"] / 22
        df["SS"] = df["DIARIO"] * 19
        
        # Configuración de tiempos
        lead_time_days = 20
        alarma_stock_days = 22
        dias_punto_reorden = 44
        max_dias_reposicion = 22
        
        # Métodos de cálculo
        df["STOCK MINIMO (Prom + SS)"] = df["PROM CONS+Proyec"] + df["SS"]
        df[f"PUNTO DE REORDEN ({dias_punto_reorden} días)"] = df["DIARIO"] * dias_punto_reorden
        
        # Generar predicciones mensuales
        resultados_completos = []
        
        # Solo considerar el primer pedido en tránsito ("-2573 AIR")
        po_en_transito = "-2573 AIR"
        
        fecha_inicio_prediccion = datetime(ultima_fecha.year, ultima_fecha.month, 1) + timedelta(days=32)
        fecha_inicio_prediccion = datetime(fecha_inicio_prediccion.year, fecha_inicio_prediccion.month, 1)
        
        for _, row in df.iterrows():
            if not isinstance(row["CODIGO"], str) or row["CODIGO"] == "Sin información":
                continue
                
            # 1. Inicialización de variables
            pedidos_pendientes = {}
            stock_inicial = row["STOCK  TOTAL"]
            consumo_diario = row["DIARIO"]
            punto_reorden = row[f"PUNTO DE REORDEN ({dias_punto_reorden} días)"]
            
            # 2. Procesar solo el PO en tránsito especificado
            if po_en_transito in cols_pedidos and "A_PEDIR" in cols_pedidos[po_en_transito]:
                col_name = cols_pedidos[po_en_transito]["A_PEDIR"]
                try:
                    unidades_po = float(row[col_name]) if pd.notna(row[col_name]) and str(row[col_name]).strip() != '' else 0.0
                except (ValueError, TypeError):
                    unidades_po = 0.0
                    
                if unidades_po > 0:
                    # Registrar el PO
                    pedidos_pendientes[po_en_transito] = {
                        "unidades": unidades_po,
                        "columna": col_name
                    }
            
            # 3. Calcular consumo proyectado hasta antes del arribo (5 días)
            consumo_proyectado_arribo = consumo_diario * 5  # 5 días de lead time para el avión            
            
            # 4. Calcular stock actual ajustado (stock inicial + PO en tránsito - consumo proyectado)
            stock_actual = stock_inicial + sum(po["unidades"] for po in pedidos_pendientes.values()) - consumo_proyectado_arribo
            
            # 5. Calcular stock total disponible (físico + POs pendientes)
            stock_total_disponible = stock_actual + sum(po["unidades"] for po in pedidos_pendientes.values())
            
            # 6. Calcular déficit (vs punto de reorden, no stock mínimo)
            deficit = max(punto_reorden - stock_total_disponible, 0)            
            
            # 7. Calcular pedidos necesarios
            cajas_pedir = int(np.ceil(deficit / row["UNID/CAJA"])) if row["UNID/CAJA"] > 0 else 0
            unidades_pedir = cajas_pedir * row["UNID/CAJA"]
            
            # 8. Configuración de parámetros temporales
            if row["DIARIO"] > 0:
                tiempo_cobertura = min(
                    stock_total_disponible / row["DIARIO"],
                    max_dias_reposicion
                )
                frecuencia_reposicion = min(
                    punto_reorden / row["DIARIO"],
                    max_dias_reposicion
                )
                dias_hasta_reposicion = max(frecuencia_reposicion - lead_time_days, 0)
                fecha_reposicion = (fecha_inicio_prediccion + timedelta(days=dias_hasta_reposicion)).strftime('%Y-%m-%d')
            else:
                tiempo_cobertura = 0
                frecuencia_reposicion = 0
                fecha_reposicion = "No aplica"
            
            # 9. Generar proyecciones mensuales CORREGIDAS
            proyecciones = []
            stock_proyectado = stock_actual
            
            for mes in range(6):
                year = fecha_inicio_prediccion.year + (fecha_inicio_prediccion.month - 1 + mes) // 12
                month = (fecha_inicio_prediccion.month - 1 + mes) % 12 + 1
                fecha = datetime(year, month, 1)
                
                # Determinar consumo mensual
                if prophet_predictions and row["CODIGO"] in prophet_predictions:
                    pred_date = datetime(fecha.year, fecha.month, 15)
                    prophet_pred = next((p for p in prophet_predictions[row["CODIGO"]] 
                                    if pd.Timestamp(p['ds']).month == pred_date.month 
                                    and pd.Timestamp(p['ds']).year == pred_date.year), None)
                    
                    consumo = max(prophet_pred['yhat'], 0) if prophet_pred else row["PROM CONS+Proyec"]
                else:
                    consumo = row["PROM CONS+Proyec"]
                
                diario = consumo / 22
                ss_mes = diario * 19
                stock_minimo_mes = consumo + ss_mes
                punto_reorden_mes = diario * dias_punto_reorden
                
                # Aplicar consumo mensual
                stock_despues_consumo = max(stock_proyectado - consumo, 0)
                
                # Calcular déficit para este mes (vs punto de reorden)
                deficit_mes = max(punto_reorden_mes - stock_despues_consumo, 0)
                
                # Solo pedir si realmente hay déficit después de considerar POs
                cajas_pedir_mes = int(np.ceil(deficit_mes / row["UNID/CAJA"])) if deficit_mes > 0 and row["UNID/CAJA"] > 0 else 0
                unidades_pedir_mes = cajas_pedir_mes * row["UNID/CAJA"]
                stock_proyectado = stock_despues_consumo + unidades_pedir_mes
                
                # Cálculos adicionales
                if diario > 0:
                    tiempo_cob_mes = min(
                        stock_proyectado / diario,  # Tiempo de cobertura basado en stock total
                        max_dias_reposicion
                    )
                    alerta_stock = stock_despues_consumo < (diario * alarma_stock_days)
                    fecha_rep_mes = (fecha + timedelta(days=max(tiempo_cob_mes - lead_time_days, 0))).strftime('%Y-%m-%d')
                else:
                    tiempo_cob_mes = 0
                    alerta_stock = False
                    fecha_rep_mes = "No aplica"
                
                info_mes = {
                    "mes": f"{SPANISH_MONTHS[fecha.month]}-{fecha.year}",
                    "stock_inicial": round(stock_proyectado, 2),
                    "stock_proyectado": round(stock_despues_consumo, 2),
                    "consumo_mensual": round(consumo, 2),
                    "consumo_diario": round(diario, 2),
                    "stock_seguridad": round(ss_mes, 2),
                    "stock_minimo": round(stock_minimo_mes, 2),
                    "punto_reorden": round(punto_reorden_mes, 2),
                    "deficit": round(deficit_mes, 2),
                    "cajas_a_pedir": cajas_pedir_mes,
                    "unidades_a_pedir": round(unidades_pedir_mes, 2),
                    "alerta_stock": alerta_stock,
                    "fecha_reposicion": fecha_rep_mes,
                    "tiempo_cobertura": round(tiempo_cob_mes, 2),
                    "frecuencia_reposicion": round(frecuencia_reposicion, 2),
                    "unidades_en_transito": sum(po["unidades"] for po in pedidos_pendientes.values()),
                    "pedidos_pendientes": pedidos_pendientes,
                    "accion_requerida": "Pedir {} cajas".format(cajas_pedir_mes) if cajas_pedir_mes > 0 else "Stock suficiente",
                    "stock_actual_ajustado": round(stock_actual, 2)
                }
                
                proyecciones.append(info_mes)
            
            # 8. Compilar información del producto
            producto_info = {
                "CODIGO": str(row["CODIGO"]),
                "DESCRIPCION": str(row["DESCRIPCION"]),
                "UNIDADES_POR_CAJA": float(row["UNID/CAJA"]),
                "STOCK_FISICO": float(stock_inicial),
                "UNIDADES_TRANSITO": sum(po["unidades"] for po in pedidos_pendientes.values()),
                "STOCK_TOTAL": float(stock_actual),
                "CONSUMO_PROMEDIO": float(row["PROM CONSU"]),
                "CONSUMO_PROYECTADO": float(row["Proyec de  Conss"]),
                "CONSUMO_TOTAL": float(row["PROM CONS+Proyec"]),
                "CONSUMO_DIARIO": float(row["DIARIO"]),
                "STOCK_SEGURIDAD": float(row["SS"]),
                "STOCK_MINIMO": float(row["STOCK MINIMO (Prom + SS)"]),
                "PUNTO_REORDEN": float(punto_reorden),
                "DEFICIT": float(deficit),
                "CAJAS_A_PEDIR": cajas_pedir,
                "UNIDADES_A_PEDIR": float(unidades_pedir),
                "FECHA_REPOSICION": fecha_reposicion,
                "DIAS_COBERTURA": round(tiempo_cobertura, 2),
                "FRECUENCIA_REPOSICION": round(frecuencia_reposicion, 2),
                "CONSUMO_PROYECTADO_ARRIBO": round(consumo_proyectado_arribo, 2),
                "STOCK_ACTUAL_AJUSTADO": round(stock_actual, 2),                
                "HISTORICO_CONSUMOS": {
                    col.split()[1] + "_" + col.split()[2]: row[col]
                    for col in cols_consumo if len(col.split()) >= 3
                },
                "PROYECCIONES": proyecciones,
                "CONFIGURACION": {
                    "DIAS_STOCK_SEGURIDAD": 19,
                    "DIAS_PUNTO_REORDEN": dias_punto_reorden,
                    "LEAD_TIME_REPOSICION": lead_time_days,
                    "DIAS_ALARMA_STOCK": alarma_stock_days,
                    "DIAS_MAX_REPOSICION": max_dias_reposicion,
                    "DIAS_LABORALES_MES": 22,
                    "VERSION_MODELO": "3.0-po-corregido"
                },
                "PEDIDOS_PENDIENTES": pedidos_pendientes
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
        df, cols_consumo, ultima_fecha, cols_pedidos = cargar_datos()
                
        # Cargar modelo Prophet
        prophet_model = cargar_modelo_prophet()
        
        # Preparar datos para Prophet si el modelo está disponible
        prophet_predictions = None
        if prophet_model:
            prophet_data = preparar_datos_prophet(df, cols_consumo)
            prophet_predictions = predecir_con_prophet(prophet_model, prophet_data)
        
        # Calcular predicciones
        _, resultados_completos = calcular_predicciones(df, cols_consumo, ultima_fecha, cols_pedidos, prophet_predictions)
        
        # Guardar resultados
        guardar_resultados(resultados_completos)
        
        logger.info("=== PROCESO COMPLETADO ===")
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"Error general: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    main()