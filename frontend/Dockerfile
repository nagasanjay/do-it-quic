FROM node:18-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package.json package-lock.json* ./
RUN npm install

# Copy source code
COPY . .

# Expose Next.js default port
EXPOSE 3000

# Start in development mode
CMD ["npm", "run", "dev"]
