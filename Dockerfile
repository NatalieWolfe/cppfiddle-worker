FROM node:6
MAINTAINER Natalie Wolfe <natalie@lifewanted.com>
ENV NODE_ENV production

# Install required version of GCC
RUN apt-get update && apt-get install -y gcc

# Create our workspace.
ENV FIDDLE_SERVER_USER_NAME cppfiddle-worker-server
ENV FIDDLE_SERVER_USER_UID 1337
ENV FIDDLE_SERVER_DIRECTORY /opt/cppfiddle/worker
RUN useradd -mu $FIDDLE_SERVER_USER_UID $FIDDLE_SERVER_USER_NAME
WORKDIR ${FIDDLE_SERVER_DIRECTORY}
RUN chown $FIDDLE_SERVER_USER_NAME:$FIDDLE_SERVER_USER_NAME \
        $FIDDLE_SERVER_DIRECTORY && \
    chmod 755 $FIDDLE_SERVER_DIRECTORY

# Create the code executor's workspace
ENV FIDDLE_EXECUTOR_USER_NAME cppfiddle-executor
ENV FIDDLE_EXECUTOR_USER_UID 7331
ENV FIDDLE_EXECUTOR_DIRECTORY /opt/cppfiddle/executor
RUN useradd -u $FIDDLE_EXECUTOR_USER_UID $FIDDLE_EXECUTOR_USER_NAME
RUN mkdir $FIDDLE_EXECUTOR_DIRECTORY && \
    chown $FIDDLE_SERVER_USER_NAME:$FIDDLE_SERVER_USER_NAME \
        $FIDDLE_EXECUTOR_DIRECTORY && \
    chmod 755 $FIDDLE_EXECUTOR_DIRECTORY

# Install packages
USER ${FIDDLE_SERVER_USER_NAME}
COPY package.json ./
RUN npm install

# Start the application
ENV PORT 8080
EXPOSE ${PORT}
COPY config ./config
COPY *.js ./
COPY lib ./lib
CMD ["npm", "start"]
