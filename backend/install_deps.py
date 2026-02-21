import sys
import subprocess

def install_package(package):
    print(f"Installing {package} to {sys.executable}...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", package])

if __name__ == "__main__":
    try:
        import sentencepiece
        print("SentencePiece is already installed.")
    except ImportError:
        install_package("sentencepiece")
        print("SentencePiece installed successfully.")
