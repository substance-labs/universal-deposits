# Use official Node.js runtime as base image
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package.json and yarn.lock from root directory
COPY package.json yarn.lock .yarnrc.yml ./

# Copy the constants and sdk packages
COPY packages/constants ./packages/constants
COPY packages/sdk ./packages/sdk

# Copy the deploy-service package
COPY packages/deploy-service ./packages/deploy-service

RUN corepack enable
# Install dependencies
RUN yarn install


# Build the sdk
WORKDIR /app/packages/sdk
RUN yarn build

# Set working directory to the deploy-service package
WORKDIR /app/packages/deploy-service

# Create logs directory
RUN mkdir -p logs

# Define the command to run the application
CMD ["yarn", "start"]