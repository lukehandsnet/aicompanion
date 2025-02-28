import os
import zipfile

def zip_directory(directory, zip_file):
    for root, dirs, files in os.walk(directory):
        for file in files:
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, os.path.dirname(directory))
            zip_file.write(file_path, arcname)

# Create a zip file of the extension
output_file = "/workspace/aicompanion/ai_companion_extension.zip"
extension_dir = "/workspace/aicompanion/extension"

with zipfile.ZipFile(output_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
    zip_directory(extension_dir, zipf)

print(f"Extension packaged as {output_file}")