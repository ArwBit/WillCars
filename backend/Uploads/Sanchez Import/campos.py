import pandas as pd
import os

# Cargar la lista original del proveedor
input_csv = 'lista_proveedor.csv'  # Lista original del proveedor
df = pd.read_csv(input_csv)

# Agregar campos faltantes
df['Modelo'] = ''  # Campo vacío intencionalmente
df['Proveedor'] = 'PS-00001'  # Proveedor fijo para Sanchez Import

# Generar rutas de imágenes basadas en el código
image_base_path = '/Uploads/Sanchez Import/Fotos_Sanchez_Import/'
df['Imagen'] = df['Código'].apply(lambda x: f"{image_base_path}{x}.jpg")

# Reordenar columnas para que coincidan con el formato esperado
output_columns = ['Código', 'Descripción', 'Marca', 'Modelo', 'Precio USD', 'Referencia', 'Proveedor', 'Imagen']
df = df[output_columns]

# Guardar el CSV listo para la web
output_csv = 'productos_listos.csv'
df.to_csv(output_csv, index=False, encoding='utf-8')
print(f"CSV generado: {output_csv}")