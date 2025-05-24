# You can use most Debian-based base images
FROM node:21-slim

# Install curl
RUN apt-get update && apt-get install -y curl && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY compile_page.sh /compile_page.sh
RUN chmod +x /compile_page.sh

# Install dependencies and customize sandbox
WORKDIR /home/user/nextjs-app

RUN npx create-next-app@14.2.20 . --ts --tailwind --no-eslint --import-alias "@/*" --use-npm --no-app --no-src-dir

RUN npx shadcn-ui@latest init -d --yes 

# Move the Nextjs app to the home directory and remove the nextjs-app directory
# This makes /home/user the root of the Next.js project.
RUN mv /home/user/nextjs-app/* /home/user/ && rm -rf /home/user/nextjs-app

WORKDIR /home/user
