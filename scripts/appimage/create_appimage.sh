#!/bin/bash

# Exit on error
set -e

# Check platform
platform=$(uname)

if [[ "$platform" == "Darwin" ]]; then
    echo "Running on macOS. Note that the AppImage created will only work on Linux systems."
    if ! command -v docker &> /dev/null; then
        echo "Docker Desktop for Mac is not installed. Please install it from https://www.docker.com/products/docker-desktop"
        exit 1
    fi
elif [[ "$platform" == "Linux" ]]; then
    echo "Running on Linux. Proceeding with AppImage creation..."
else
    echo "This script is intended to run on macOS or Linux. Current platform: $platform"
    exit 1
fi

# Enable BuildKit
export DOCKER_BUILDKIT=1

BUILD_IMAGE_NAME="statuz-appimage-builder"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "Docker is not running. Please start Docker first."
    exit 1
fi

# Check and install Buildx if needed
if ! docker buildx version >/dev/null 2>&1; then
    echo "Installing Docker Buildx..."
    mkdir -p ~/.docker/cli-plugins/
    curl -SL https://github.com/docker/buildx/releases/download/v0.13.1/buildx-v0.13.1.linux-amd64 -o ~/.docker/cli-plugins/docker-buildx
    chmod +x ~/.docker/cli-plugins/docker-buildx
fi

# Download appimagetool if not present
if [ ! -f "appimagetool" ]; then
    echo "Downloading appimagetool..."
    wget -O appimagetool "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"
    chmod +x appimagetool
fi

# Delete any existing AppImage to avoid bloating the build
rm -f Statuz-x86_64.AppImage

# Create build Dockerfile
echo "Creating build Dockerfile..."
cat > Dockerfile.build << 'EOF'
# syntax=docker/dockerfile:1
FROM ubuntu:20.04

# Install required dependencies
RUN apt-get update && apt-get install -y \
    libfuse2 \
    libglib2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxss1 \
    libxtst6 \
    libnss3 \
    libasound2 \
    libdrm2 \
    libgbm1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
EOF

# Create .dockerignore file
echo "Creating .dockerignore file..."
cat > .dockerignore << EOF
Dockerfile.build
.dockerignore
.git
.gitignore
.DS_Store
*~
*.swp
*.swo
*.tmp
*.bak
*.log
*.err
node_modules/
venv/
*.egg-info/
*.tox/
dist/
EOF

# Build Docker image without cache
echo "Building Docker image (no cache)..."
docker build --no-cache -t "$BUILD_IMAGE_NAME" -f Dockerfile.build .

# Create AppImage using local appimagetool
echo "Creating AppImage..."
docker run --rm --privileged -v "$(pwd):/app" "$BUILD_IMAGE_NAME" bash -c '
cd /app && \
rm -rf StatuzApp.AppDir && \
mkdir -p StatuzApp.AppDir/usr/bin StatuzApp.AppDir/usr/lib StatuzApp.AppDir/usr/share/applications && \
find . -maxdepth 1 ! -name StatuzApp.AppDir ! -name "." ! -name ".." -exec cp -r {} StatuzApp.AppDir/usr/bin/ \; && \
cp statuz.png StatuzApp.AppDir/ && \
echo "[Desktop Entry]" > StatuzApp.AppDir/statuz.desktop && \
echo "Name=Statuz IDE" >> StatuzApp.AppDir/statuz.desktop && \
echo "Comment=Open source AI code editor." >> StatuzApp.AppDir/statuz.desktop && \
echo "GenericName=Text Editor" >> StatuzApp.AppDir/statuz.desktop && \
echo "Exec=statuz %F" >> StatuzApp.AppDir/statuz.desktop && \
echo "Icon=statuz" >> StatuzApp.AppDir/statuz.desktop && \
echo "Type=Application" >> StatuzApp.AppDir/statuz.desktop && \
echo "StartupNotify=false" >> StatuzApp.AppDir/statuz.desktop && \
echo "StartupWMClass=Statuz IDE" >> StatuzApp.AppDir/statuz.desktop && \
echo "Categories=TextEditor;Development;IDE;" >> StatuzApp.AppDir/statuz.desktop && \
echo "MimeType=application/x-statuz-workspace;" >> StatuzApp.AppDir/statuz.desktop && \
echo "Keywords=statuz;" >> StatuzApp.AppDir/statuz.desktop && \
echo "Actions=new-empty-window;" >> StatuzApp.AppDir/statuz.desktop && \
echo "[Desktop Action new-empty-window]" >> StatuzApp.AppDir/statuz.desktop && \
echo "Name=New Empty Window" >> StatuzApp.AppDir/statuz.desktop && \
echo "Name[de]=Neues leeres Fenster" >> StatuzApp.AppDir/statuz.desktop && \
echo "Name[es]=Nueva ventana vacía" >> StatuzApp.AppDir/statuz.desktop && \
echo "Name[fr]=Nouvelle fenêtre vide" >> StatuzApp.AppDir/statuz.desktop && \
echo "Name[it]=Nuova finestra vuota" >> StatuzApp.AppDir/statuz.desktop && \
echo "Name[ja]=新しい空のウィンドウ" >> StatuzApp.AppDir/statuz.desktop && \
echo "Name[ko]=새 빈 창" >> StatuzApp.AppDir/statuz.desktop && \
echo "Name[ru]=Новое пустое окно" >> StatuzApp.AppDir/statuz.desktop && \
echo "Name[zh_CN]=新建空窗口" >> StatuzApp.AppDir/statuz.desktop && \
echo "Name[zh_TW]=開新空視窗" >> StatuzApp.AppDir/statuz.desktop && \
echo "Exec=statuz --new-window %F" >> StatuzApp.AppDir/statuz.desktop && \
echo "Icon=statuz" >> StatuzApp.AppDir/statuz.desktop && \
chmod +x StatuzApp.AppDir/statuz.desktop && \
cp StatuzApp.AppDir/statuz.desktop StatuzApp.AppDir/usr/share/applications/ && \
echo "[Desktop Entry]" > StatuzApp.AppDir/statuz-url-handler.desktop && \
echo "Name=Statuz IDE - URL Handler" > StatuzApp.AppDir/statuz-url-handler.desktop && \
echo "Comment=Open source AI code editor." > StatuzApp.AppDir/statuz-url-handler.desktop && \
echo "GenericName=Text Editor" > StatuzApp.AppDir/statuz-url-handler.desktop && \
echo "Exec=statuz --open-url %U" > StatuzApp.AppDir/statuz-url-handler.desktop && \
echo "Icon=statuz" > StatuzApp.AppDir/statuz-url-handler.desktop && \
echo "Type=Application" > StatuzApp.AppDir/statuz-url-handler.desktop && \
echo "NoDisplay=true" > StatuzApp.AppDir/statuz-url-handler.desktop && \
echo "StartupNotify=true" > StatuzApp.AppDir/statuz-url-handler.desktop && \
echo "Categories=Utility;TextEditor;Development;IDE;" > StatuzApp.AppDir/statuz-url-handler.desktop && \
echo "MimeType=x-scheme-handler/statuz;" > StatuzApp.AppDir/statuz-url-handler.desktop && \
echo "Keywords=statuz;" > StatuzApp.AppDir/statuz-url-handler.desktop && \
chmod +x StatuzApp.AppDir/statuz-url-handler.desktop && \
cp StatuzApp.AppDir/statuz-url-handler.desktop StatuzApp.AppDir/usr/share/applications/ && \
echo "#!/bin/bash" > StatuzApp.AppDir/AppRun && \
echo "HERE=\$(dirname \"\$(readlink -f \"\${0}\")\")" >> StatuzApp.AppDir/AppRun && \
echo "export PATH=\${HERE}/usr/bin:\${PATH}" >> StatuzApp.AppDir/AppRun && \
echo "export LD_LIBRARY_PATH=\${HERE}/usr/lib:\${LD_LIBRARY_PATH}" >> StatuzApp.AppDir/AppRun && \
echo "exec \${HERE}/usr/bin/statuz --no-sandbox \"\$@\"" >> StatuzApp.AppDir/AppRun && \
chmod +x StatuzApp.AppDir/AppRun && \
chmod -R 755 StatuzApp.AppDir && \

# Strip unneeded symbols from the binary to reduce size
strip --strip-unneeded StatuzApp.AppDir/usr/bin/statuz

ls -la StatuzApp.AppDir/ && \
ARCH=x86_64 ./appimagetool -n StatuzApp.AppDir Statuz-x86_64.AppImage
'

# Clean up
rm -rf StatuzApp.AppDir .dockerignore appimagetool

echo "AppImage creation complete! Your AppImage is: Statuz-x86_64.AppImage"
