FROM node:14.15.0-alpine
LABEL maintainer="somprasong.damyos@gmail.com"
# Expose ports (for orchestrators and dynamic reverse proxies)
EXPOSE 3000
# Define working directory and copy source
WORKDIR /app
RUN mkdir .authorized_key
VOLUME /app/.authorized_key
COPY ./package* ./
RUN npm ci && \
  npm cache clean --force
COPY ./src ./src
# Start the app
CMD ["node", "src/index.js"]
