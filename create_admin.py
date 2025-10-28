# Run this script to create an admin user for Emotion Aware AI
# Usage: python create_admin.py

from server.admin import create_admin

if __name__ == "__main__":
    username = input("Enter admin username: ")
    password = input("Enter admin password: ")
    create_admin(username, password)
    print(f"Admin user '{username}' created successfully.")
