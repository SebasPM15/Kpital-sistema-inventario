import json
import re
import sys
import os
import argparse
from matplotlib.dates import relativedelta
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
parser.add_argument('--dias_transito', type=int, default=0,
                   help='Días de tránsito para los pedidos (laborables)')
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

def parsear_fecha_excel(fecha_celda):
    """Intenta parsear la fecha desde diferentes formatos posibles en Excel."""
    try:
        # Si ya es un objeto datetime (pandas lo convierte automáticamente)
        if isinstance(fecha_celda, (datetime, pd.Timestamp)):
            return fecha_celda
        
        # Mapeo de meses en español a números
        meses_espanol = {
            'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6,
            'jul': 7, 'ago': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12
        }
        
        fecha_str = str(fecha_celda).strip().lower()
        
        # Intentar parsear formato "14/feb/25" o "14/02/2025"
        if '/' in fecha_str:
            partes = fecha_str.split('/')
            if len(partes) == 3:
                dia, mes, anio = partes
                
                # Verificar si el mes es texto (ej. "feb")
                mes_num = None
                if mes[:3] in meses_espanol:
                    mes_num = meses_espanol[mes[:3]]
                else:
                    # Intentar como número
                    try:
                        mes_num = int(mes)
                    except ValueError:
                        pass
                
                if mes_num:
                    # Manejar año con 2 o 4 dígitos
                    anio_completo = 2000 + int(anio) if len(anio) == 2 else int(anio)
                    return datetime(anio_completo, mes_num, int(dia))
        
        # Intentar parsear con pandas por si acaso
        try:
            return pd.to_datetime(fecha_str)
        except:
            pass
        
        # Si no se pudo parsear, devolver None
        return None
        
    except Exception as e:
        logger.error(f"Error al parsear fecha: {str(e)}")
        return None

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
        
        # Leer la fecha desde la celda A2 (primera columna, segunda fila)
        fecha_df = pd.read_excel(args.excel, header=None, nrows=2)
        fecha_celda = fecha_df.iloc[1, 0]
        logger.info(f"Fecha cruda extraída de A2: {fecha_celda}")

        # Parsear la fecha
        fecha_inicio_prediccion = parsear_fecha_excel(fecha_celda)
        
        if fecha_inicio_prediccion is None:
            fecha_inicio_prediccion = datetime(2025, 2, 14)  # Fecha por defecto
            logger.warning(f"No se pudo parsear la fecha de A2, usando fecha por defecto: {fecha_inicio_prediccion}")
        else:
            logger.info(f"Fecha parseada de A2: {fecha_inicio_prediccion}")  
        
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
    
        return df, cols_consumo, ultima_fecha, cols_pedidos, fecha_inicio_prediccion

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

def calcular_consumo_mensual(row, month, year, dias_consumo_mensual, prophet_predictions, cols_consumo):
    """Calcula el consumo mensual dinámico considerando múltiples factores."""
    try:
        # 1. Consumo base (promedio histórico)
        consumo_base = row["DIARIO"] * dias_consumo_mensual
        
        # 2. Obtener histórico para este mes específico
        mes_historico = f"{SPANISH_MONTHS[month].upper()[:3]}"
        historicos_mes = [float(row[col]) for col in cols_consumo if mes_historico in col and pd.notna(row[col])]
        
        # 3. Obtener predicción Prophet si existe
        pred_prophet = None
        if prophet_predictions and row["CODIGO"] in prophet_predictions:
            try:
                pred = next(
                    (p for p in prophet_predictions[row["CODIGO"]] 
                    if pd.to_datetime(p['ds']).month == month and pd.to_datetime(p['ds']).year == year),
                    None
                )
                if pred:
                    pred_prophet = pred['yhat'] * dias_consumo_mensual
            except Exception as e:
                logger.error(f"Error obteniendo predicción Prophet: {str(e)}")
                pred_prophet = None
        
        # 4. Calcular tendencia reciente (últimos 3 meses)
        try:
            if len(cols_consumo) >= 3:
                ultimos_3 = [float(row[col]) for col in cols_consumo[-3:] if pd.notna(row[col]) and float(row[col]) > 0]
                if len(ultimos_3) >= 2:
                    diff = np.diff(ultimos_3)
                    if len(diff) > 0 and np.mean(ultimos_3[:-1]) != 0:
                        crecimiento = np.mean(diff) / np.mean(ultimos_3[:-1])
                        factor_crecimiento = min(1.5, max(0.5, 1 + crecimiento))  # Limitar entre 0.5 y 1.5
                    else:
                        factor_crecimiento = 1.0
                else:
                    factor_crecimiento = 1.0
            else:
                factor_crecimiento = 1.0
        except Exception as e:
            logger.error(f"Error calculando tendencia: {str(e)}")
            factor_crecimiento = 1.0
        
        # 5. Lógica de combinación inteligente
        if historicos_mes and pred_prophet:
            # Ponderación: 50% Prophet, 30% histórico del mes, 20% base
            historico_promedio = np.mean(historicos_mes)
            consumo = (0.5 * pred_prophet) + (0.3 * historico_promedio) + (0.2 * consumo_base)
        elif historicos_mes:
            # Si solo tenemos histórico del mes: 70% histórico, 30% base
            historico_promedio = np.mean(historicos_mes)
            consumo = (0.7 * historico_promedio) + (0.3 * consumo_base)
        elif pred_prophet:
            # Si solo tenemos Prophet: 80% Prophet, 20% base
            consumo = (0.8 * pred_prophet) + (0.2 * consumo_base)
        else:
            # Solo consumo base
            consumo = consumo_base
        
        # 6. Aplicar factor de crecimiento
        consumo *= factor_crecimiento
        
        # 7. Asegurar mínimo razonable (al menos 50% del consumo base)
        consumo_minimo = consumo_base * 0.5
        consumo = max(consumo, consumo_minimo)
        
        return float(round(consumo, 2))
    
    except Exception as e:
        logger.error(f"Error en calcular_consumo_mensual: {str(e)}")
        return float(round(row["DIARIO"] * dias_consumo_mensual, 2))

def sumar_dias_laborables(fecha_inicio, dias):
    """Suma días laborables (lunes a viernes) a una fecha inicial."""
    fecha_actual = fecha_inicio
    dias_sumados = 0
    
    while dias_sumados < dias:
        fecha_actual += timedelta(days=1)
        # Considerar solo días laborables (lunes a viernes)
        if fecha_actual.weekday() < 5:  # 0 = lunes, 4 = viernes
            dias_sumados += 1
            
    return fecha_actual

def calcular_predicciones(df, cols_consumo, ultima_fecha, fecha_inicio_prediccion, dias_transito, prophet_predictions=None):
    """Calcula las predicciones con consumos mensuales dinámicos."""
    try:
        logger.info("Calculando predicciones con consumos dinámicos...")
        logger.info(f"Fecha de inicio para predicciones: {fecha_inicio_prediccion}")
        logger.info(f"Días de tránsito: {dias_transito}")
        
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
        dias_consumo_mensual = 20

        # Métodos de cálculo
        df["STOCK MINIMO (Prom + SS)"] = df["PROM CONS+Proyec"] + df["SS"]
        df[f"PUNTO DE REORDEN ({dias_punto_reorden} días)"] = df["DIARIO"] * dias_punto_reorden
        
        # Generar predicciones mensuales
        resultados_completos = []

        # Calcular fecha de arribo (solo días laborables)
        fecha_arribo = fecha_inicio_prediccion
        if dias_transito > 0:
            fecha_arribo = sumar_dias_laborables(fecha_inicio_prediccion, dias_transito)
            logger.info(f"Fecha de arribo calculada: {fecha_arribo.strftime('%Y-%m-%d')}")
        
        # Fechas clave ajustadas
        fecha_consumo_inicio = fecha_inicio_prediccion
        fecha_consumo_fin = sumar_dias_laborables(fecha_consumo_inicio, dias_transito) if dias_transito > 0 else fecha_consumo_inicio       
        
        logger.info(f"Período de consumo inicial: {fecha_consumo_inicio.strftime('%Y-%m-%d')} a {fecha_consumo_fin.strftime('%Y-%m-%d')} ({dias_transito} días laborables)")
        
        for _, row in df.iterrows():
            if not isinstance(row["CODIGO"], str) or row["CODIGO"] == "Sin información":
                continue
                
            # 1. Inicialización de variables
            pedidos_pendientes = {}
            stock_inicial = row["STOCK  TOTAL"]
            consumo_diario = row["DIARIO"]
            punto_reorden = row[f"PUNTO DE REORDEN ({dias_punto_reorden} días)"]
            stock_seguridad = row["SS"]  # Fijo
            stock_minimo = row["STOCK MINIMO (Prom + SS)"]  # Fijo
            
            # 3. Cálculos iniciales de stock
            consumo_proyectado_arribo  = 0
            stock_antes_arribo = stock_inicial
            if dias_transito > 0:
                consumo_proyectado_arribo = consumo_diario * dias_transito
            stock_antes_arribo = max(stock_inicial - consumo_proyectado_arribo, 0)
            
            stock_actual = stock_antes_arribo
            deficit = max(punto_reorden - stock_actual, 0)
            
            # 4. Calcular pedidos necesarios
            cajas_pedir = int(np.ceil(deficit / row["UNID/CAJA"])) if row["UNID/CAJA"] > 0 else 0
            unidades_pedir = cajas_pedir * row["UNID/CAJA"]
            
            # 5. Configuración temporal
            if row["DIARIO"] > 0:
                tiempo_cobertura = min(stock_actual / row["DIARIO"], max_dias_reposicion)
                frecuencia_reposicion = min(punto_reorden / row["DIARIO"], max_dias_reposicion)
                dias_hasta_reposicion = max(frecuencia_reposicion - lead_time_days, 0)
                fecha_reposicion = (fecha_consumo_inicio + timedelta(days=dias_hasta_reposicion)).strftime('%Y-%m-%d')
                fecha_arribo_pedido = (fecha_consumo_inicio + timedelta(days=dias_transito)).strftime('%Y-%m-%d') if dias_transito > 0 else "No aplica"
            else:
                tiempo_cobertura = 0
                frecuencia_reposicion = 0
                fecha_reposicion = "No aplica"
                fecha_arribo_pedido = "No aplica"
            
            # 6. Generar proyecciones mensuales con consumos dinámicos
            proyecciones = []
            stock_proyectado = stock_actual
            
            for mes in range(6):
                current_date = fecha_arribo + relativedelta(months=mes)
                year = current_date.year
                month = current_date.month
                
                # CÁLCULO DINÁMICO DEL CONSUMO MENSUAL (VERSIÓN MEJORADA)
                consumo = calcular_consumo_mensual(
                    row=row,
                    month=month,
                    year=year,
                    dias_consumo_mensual=dias_consumo_mensual,
                    prophet_predictions=prophet_predictions,
                    cols_consumo=cols_consumo
                )
                
                # Resto de cálculos mensuales
                diario = consumo_diario
                ss_mes = stock_seguridad
                stock_minimo_mes = stock_minimo
                punto_reorden_mes = punto_reorden
                
                stock_despues_consumo = max(stock_proyectado - consumo, 0)
                
                # Nueva lógica para optimizar unidades a pedir
                stock_objetivo = (stock_seguridad + stock_minimo) / 2
                deficit_mes = max(stock_objetivo - stock_despues_consumo, 0)
                # Ajuste para evitar quiebres de stock
                if stock_despues_consumo < stock_seguridad:
                    deficit_mes = max(stock_seguridad - stock_despues_consumo, deficit_mes)
                
                cajas_pedir_mes = int(np.ceil(deficit_mes / row["UNID/CAJA"])) if deficit_mes > 0 and row["UNID/CAJA"] > 0 else 0
                unidades_pedir_mes = cajas_pedir_mes * row["UNID/CAJA"]
                stock_proyectado = stock_despues_consumo + unidades_pedir_mes           
                
                if diario > 0:
                    tiempo_cob_mes = min(stock_proyectado / diario, max_dias_reposicion)
                    alerta_stock = bool(stock_despues_consumo < (diario * (alarma_stock_days + 10)))  # 10 días adicionales de anticipación
                    fecha_rep_mes = (current_date + timedelta(days=max(tiempo_cob_mes - lead_time_days, 0))).strftime('%Y-%m-%d')
                    fecha_solicitud_mes = (current_date + timedelta(days=max(tiempo_cob_mes - lead_time_days - 5, 0))).strftime('%Y-%m-%d')
                    fecha_arribo_mes = (current_date + timedelta(days=max(tiempo_cob_mes - 5, 0))).strftime('%Y-%m-%d')
                else:
                    tiempo_cob_mes = 0
                    alerta_stock = False
                    fecha_rep_mes = "No aplica"
                    fecha_solicitud_mes = "No aplica"
                    fecha_arribo_mes = "No aplica"
                
                info_mes = {
                    "mes": f"{SPANISH_MONTHS[month]}-{year}",
                    "dias_transito": dias_transito,
                    "stock_inicial": float(round(stock_actual, 2)),
                    "stock_proyectado": float(round(stock_despues_consumo, 2)),
                    "consumo_mensual": float(round(consumo, 2)),
                    "consumo_diario": float(round(diario, 2)),
                    "stock_seguridad": float(round(ss_mes, 2)),
                    "stock_minimo": float(round(stock_minimo_mes, 2)),
                    "punto_reorden": float(round(punto_reorden_mes, 2)),
                    "deficit": float(round(deficit_mes, 2)),
                    "cajas_a_pedir": int(cajas_pedir_mes),
                    "unidades_a_pedir": float(round(unidades_pedir_mes, 2)),
                    "alerta_stock": alerta_stock,
                    "fecha_reposicion": str(fecha_rep_mes),
                    "fecha_solicitud": str(fecha_solicitud_mes),
                    "fecha_arribo": str(fecha_arribo_mes),
                    "tiempo_cobertura": float(round(tiempo_cob_mes, 2)),
                    "frecuencia_reposicion": float(round(frecuencia_reposicion, 2)),
                    "unidades_en_transito": 0.0,
                    "pedidos_pendientes": pedidos_pendientes,
                    "pedidos_recibidos": 0,  # Se actualizará en el siguiente mes
                    "accion_requerida": f"Pedir {cajas_pedir_mes} cajas" if cajas_pedir_mes > 0 else "Stock suficiente",
                    "stock_actual_ajustado": float(round(stock_actual, 2)),
                    "consumo_inicial_5dias": float(round(consumo_proyectado_arribo, 2)),
                    "fecha_inicio_proyeccion": str(fecha_inicio_prediccion.strftime('%Y-%m-%d')),
                    "dias_consumo_mensual": int(dias_consumo_mensual),
                    "stock_total": float(round(stock_actual + sum(po["unidades"] for po in pedidos_pendientes.values()), 2))  # Stock inicial + unidades en tránsito
                }
                
                proyecciones.append(info_mes)
            
            # Compilar información del producto
            producto_info = {
                "CODIGO": str(row["CODIGO"]),
                "DESCRIPCION": str(row["DESCRIPCION"]),
                "FECHA_INICIO": str(fecha_inicio_prediccion.strftime('%Y-%m-%d')),
                "UNIDADES_POR_CAJA": float(row["UNID/CAJA"]),
                "STOCK_FISICO": float(stock_antes_arribo),
                "UNIDADES_TRANSITO": float(sum(po["unidades"] for po in pedidos_pendientes.values())),
                "STOCK_TOTAL": float(stock_actual),
                "CONSUMO_PROMEDIO": float(row["PROM CONSU"]),
                "CONSUMO_PROYECTADO": float(row["Proyec de  Conss"]),
                "CONSUMO_TOTAL": float(row["PROM CONS+Proyec"]),
                "CONSUMO_DIARIO": float(row["DIARIO"]),
                "STOCK_SEGURIDAD": float(row["SS"]),
                "STOCK_MINIMO": float(row["STOCK MINIMO (Prom + SS)"]),
                "PUNTO_REORDEN": float(punto_reorden),
                "DEFICIT": float(deficit),
                "CAJAS_A_PEDIR": int(cajas_pedir),
                "UNIDADES_A_PEDIR": float(unidades_pedir),
                "FECHA_REPOSICION": str(fecha_reposicion),
                "DIAS_COBERTURA": float(round(tiempo_cobertura, 2)),
                "FRECUENCIA_REPOSICION": float(round(frecuencia_reposicion, 2)),
                "CONSUMO_PROYECTADO_ARRIBO": float(round(consumo_proyectado_arribo, 2)),
                "STOCK_ACTUAL_AJUSTADO": float(round(stock_actual, 2)),
                "HISTORICO_CONSUMOS": {
                    col.split()[1] + "_" + col.split()[2]: float(row[col])
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
                    "DIAS_TRANSITO": dias_transito,  # Nuevo campo para días de tránsito
                    "VERSION_MODELO": "3.3-dynamic-v2"
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
        df, cols_consumo, ultima_fecha, fecha_inicio_prediccion = cargar_datos()
                
        # Cargar modelo Prophet
        prophet_model = cargar_modelo_prophet()
        
        # Preparar datos para Prophet si el modelo está disponible
        prophet_predictions = None
        if prophet_model:
            prophet_data = preparar_datos_prophet(df, cols_consumo)
            prophet_predictions = predecir_con_prophet(prophet_model, prophet_data)
        
        # Calcular predicciones
        _, resultados_completos = calcular_predicciones(
            df, cols_consumo, ultima_fecha, 
            fecha_inicio_prediccion, args.dias_transito, prophet_predictions
        )

        # Guardar resultados
        guardar_resultados(resultados_completos)
        
        logger.info("=== PROCESO COMPLETADO ===")
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"Error general: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    main()