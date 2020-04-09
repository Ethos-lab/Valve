FROM node:10.12.0-alpine as ship

############# ADDED 1 #######################
COPY of-watchdog /usr/bin/fwatchdog
RUN chmod +x /usr/bin/fwatchdog
############# ADDED 1 END #####################

############# ADDED 2 #######################
#FROM alpine:3.8
RUN apk update && \
apk add --no-cache strace perl ca-certificates

# Installing certificate
COPY certs/mitmproxy-ca-cert.pem /usr/local/share/ca-certificates

# Add non root user mitmproxy
RUN addgroup -S mitmproxy && adduser -S -G mitmproxy mitmproxy \
    && mkdir -p /home/mitmproxy

WORKDIR /home/mitmproxy

RUN chown -R mitmproxy /home/mitmproxy

# custom watchdog setup with tracing---------------------------
# edit the from to desired image

#DONT USE ANY FROM AFTERWARDS: IT STARTS CREATING NEW IMAGE
#FROM alpine:3.8


# mitmproxy setup------------------------

ENV LANG=en_US.UTF-8

ARG WHEEL_MITMPROXY
ARG WHEEL_BASENAME_MITMPROXY

COPY $WHEEL_MITMPROXY /home/mitmproxy/
# Add our user first to make sure the ID get assigned consistently,
# regardless of whatever dependencies get added.
#RUN addgroup -S mitmproxy && adduser -S -G mitmproxy mitmproxy \
RUN apk add --no-cache \
        su-exec \
        git \
        g++ \
        libffi \
        libffi-dev \
        libstdc++ \
        openssl \
        openssl-dev \
        python3 \
        python3-dev \
        iptables \
        curl \
    && python3 -m ensurepip --upgrade \
    && pip3 install -U pip \
    && LDFLAGS=-L/lib pip3 install -U /home/mitmproxy/${WHEEL_BASENAME_MITMPROXY} \
    && apk del --purge \
        git \
        g++ \
        libffi-dev \
        openssl-dev \
        python3-dev \
    && rm -rf ~/.cache/pip /home/mitmproxy/${WHEEL_BASENAME_MITMPROXY} \
    && update-ca-certificates

VOLUME /home/mitmproxy/.mitmproxy

COPY release/docker/docker-entrypoint.sh /usr/local/bin/

############# ADDED 2 END #######################

WORKDIR /root/

# Turn down the verbosity to default level.
ENV NPM_CONFIG_LOGLEVEL warn

RUN addgroup -S app && adduser -S -g app app \
    && mkdir -p /home/app

# Wrapper/boot-strapper
WORKDIR /home/app
COPY package.json ./

# This ordering means the npm installation is cached for the outer function handler.
RUN npm i

# RUN cd function/kv-store && npm i
# Copy outer function handler
COPY index.js ./

# COPY function node packages and install, adding this as a separate
# entry allows caching of npm install
WORKDIR /home/app/function
COPY function/*.json ./
# COPY function/kv-store ./kv-store

#RUN ls && pwd && cat package.json

RUN npm i || :

# COPY function files and folders
COPY function/ ./

# Set correct permissions to use non root user
WORKDIR /home/app/

############# ADDED 3 #######################
#COPY --from=ship /usr/bin/fwatchdog         .
COPY tracefile.pl /home/app
ADD certs /home/app/certs

# chmod for tmp is for a buildkit issue (@alexellis)
RUN chown app:app -R /home/app \
    && chmod 777 /tmp

# the following line is added to get some data on a working dockerfile
VOLUME /home/app
############# ADDED 3 END #######################

USER app

EXPOSE 3306 8081 8082 8083
ENV HTTP_PROXY "http://127.0.0.1:8082"
ENV HTTPS_PROXY "http://127.0.0.1:8082"

ENV cgi_headers="true"
ENV fprocess="node index.js"
ENV mode="http"
ENV upstream_url="http://127.0.0.1:3000"

ENV exec_timeout="0s"
ENV write_timeout="15s"
ENV read_timeout="15s"

HEALTHCHECK --interval=3s CMD [ -e /tmp/.lock ] || exit 1

CMD ["fwatchdog"]
