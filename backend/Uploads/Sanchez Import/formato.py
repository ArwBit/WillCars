import os

# Directorio de imágenes
image_dir = '/ruta/a/tus/imagenes'
# Supongamos que tienes un mapeo de nombres de archivo a códigos
# Ejemplo: {'imagen1.jpg': '15656416', 'imagen2.jpg': '2-40-1521'}
image_mapping = {'imagen1.jpg': '15656416', 'imagen2.jpg': '2-40-1521'}

for old_name, code in image_mapping.items():
    old_path = os.path.join(image_dir, old_name)
    new_name = f"{code}.jpg"
    new_path = os.path.join(image_dir, new_name)
    if os.path.exists(old_path):
        os.rename(old_path, new_path)
        print(f"Renombrado: {old_name} -> {new_name}")
    else:
        print(f"No se encontró: {old_name}")