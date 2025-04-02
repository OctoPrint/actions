FROM alpine:latest


RUN apk add --no-cache curl jq bash unzip grep

ARG GH_CLI_VERSION_DOWNLOAD_URL="https://github.com/cli/cli/releases/download/v2.7.0/gh_2.7.0_linux_386.tar.gz"
RUN curl -sLo /tmp/ghlinux.tar.gz ${GH_CLI_VERSION_DOWNLOAD_URL} && tar --strip-components=1 -xf /tmp/ghlinux.tar.gz && rm /tmp/ghlinux.tar.gz
RUN gh version

COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT [ "/entrypoint.sh" ]
