# Use official Node.js runtime as base image
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Add build dependencies
RUN apk add --no-cache python3 make g++

# Copy package.json and yarn.lock from root directory
COPY package.json yarn.lock .yarnrc.yml ./

# Copy the packages
COPY packages/constants ./packages/constants
COPY packages/sdk ./packages/sdk
COPY packages/api ./packages/api
COPY packages/app ./packages/app

RUN corepack enable

# Install dependencies
RUN yarn install 


# Build the sdk
WORKDIR /app/packages/sdk
RUN yarn build

# Build the app
WORKDIR /app/packages/app
RUN yarn install
RUN yarn build

# Set working directory to the API package
WORKDIR /app/packages/api

# Expose the port the app runs on
EXPOSE 3000

# Define the command to run the application
CMD ["yarn", "start"]