FROM node:6
MAINTAINER Natalie Wolfe <natalie@lifewanted.com>
ENV NODE_ENV production

# Install required version of GCC
RUN apt-get update && apt-get install -y gcc

# Create our workspace.
ENV SERVER_USER_NAME cppfiddle-worker-server
ENV SERVER_USER_UID 1337
ENV SERVER_DIRECTORY /opt/cppfiddle/worker
RUN useradd -mu $SERVER_USER_UID $SERVER_USER_NAME
WORKDIR ${SERVER_DIRECTORY}
RUN chown $SERVER_USER_NAME:$SERVER_USER_NAME $SERVER_DIRECTORY && \
    chmod 755 $SERVER_DIRECTORY

# Create the code executor's workspace
ENV EXECUTOR_USER_NAME cppfiddle-executor
ENV EXECUTOR_USER_UID 7331
ENV EXECUTOR_DIRECTORY /opt/cppfiddle/executor
RUN useradd -u $EXECUTOR_USER_UID $EXECUTOR_USER_NAME
RUN mkdir $EXECUTOR_DIRECTORY && \
    chown $SERVER_USER_NAME:$SERVER_USER_NAME $EXECUTOR_DIRECTORY && \
    chmod 755 $EXECUTOR_DIRECTORY

# Install packages
USER ${SERVER_USER_NAME}
COPY package.json ./
RUN npm install

# Start the application
ENV PORT 8080
EXPOSE ${PORT}
COPY *.js ./
COPY lib ./lib
CMD ["npm", "start"]
