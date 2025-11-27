#!/bin/bash

# Create missing directories
mkdir -p "app/orders/[id]"
mkdir -p "app/menu/[id]/edit"
mkdir -p "app/promos/new"

echo "Directories created successfully"
ls -la app/orders/
ls -la app/menu/
ls -la app/promos/
