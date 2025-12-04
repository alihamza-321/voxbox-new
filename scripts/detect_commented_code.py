import os
import re
import sys

TARGET_DIR = "src"   # change this if your code is not inside /src


commented_code_pattern = re.compile(r'^\s*#.*[a-zA-Z0-9_]+\s*\(.*\)')

def scan_file(filepath):
    with open(filepath, "r", encoding="utf-8") as file:
        lines = file.readlines()

    commented_lines = []

    for line in lines:
        if commented_code_pattern.match(line):
            commented_lines.append(line.strip())

    if commented_lines:
        print(f"\n Commented-out code found in: {filepath}")
        for line in commented_lines:
            print(f"  → {line}")
        return True

    return False

def scan_directory(directory):
    has_error = False

    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith((".py", ".js", ".ts")):  # you can modify this list
                filepath = os.path.join(root, file)
                if scan_file(filepath):
                    has_error = True

    return has_error


if __name__ == "__main__":
    print("🔍 Scanning for commented-out code...")

    errors_found = scan_directory(TARGET_DIR)

    if errors_found:
        print("\n Build failed because commented-out code was detected.")
        sys.exit(1)

    print(" No commented-out code found!")
    sys.exit(0)
