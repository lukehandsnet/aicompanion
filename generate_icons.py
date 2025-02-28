from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, output_path):
    # Create a new image with a white background
    img = Image.new('RGBA', (size, size), color=(255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw a blue circle
    circle_color = (74, 111, 165, 255)  # #4A6FA5
    padding = size // 10
    draw.ellipse([(padding, padding), (size - padding, size - padding)], fill=circle_color)
    
    # Draw a chat bubble
    if size >= 48:  # Only for larger icons
        bubble_color = (255, 255, 255, 255)
        bubble_size = size // 3
        bubble_x = size // 2
        bubble_y = size // 2
        draw.ellipse([(bubble_x - bubble_size//2, bubble_y - bubble_size//2), 
                     (bubble_x + bubble_size//2, bubble_y + bubble_size//2)], fill=bubble_color)
    
    # Save the image
    img.save(output_path)
    print(f"Created icon: {output_path}")

# Create directory if it doesn't exist
icon_dir = "/workspace/aicompanion/extension/images"
os.makedirs(icon_dir, exist_ok=True)

# Create icons of different sizes
create_icon(16, os.path.join(icon_dir, "icon16.png"))
create_icon(48, os.path.join(icon_dir, "icon48.png"))
create_icon(128, os.path.join(icon_dir, "icon128.png"))