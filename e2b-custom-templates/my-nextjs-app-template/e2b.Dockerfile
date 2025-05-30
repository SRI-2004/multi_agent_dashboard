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

# Add shadcn/ui chart component
RUN npx shadcn-ui@latest add chart --yes

# Add shadcn Card and Typography components
RUN npx shadcn-ui@latest add card --yes
RUN npx shadcn-ui@latest add typography --yes

# Install Chart.js (with React wrapper) and Recharts for additional charting options
RUN npm install react-chartjs-2 chart.js recharts

# Install Nivo charting libraries for shadcn/ui-compatible charts
RUN npm install @nivo/bar @nivo/line @nivo/pie

# Move the Nextjs app to the home directory and remove the nextjs-app directory
# This makes /home/user the root of the Next.js project.
RUN cp -a /home/user/nextjs-app/. /home/user/ && rm -rf /home/user/nextjs-app

WORKDIR /home/user
