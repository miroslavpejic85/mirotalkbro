FROM node:18-alpine 

WORKDIR /src

COPY package.json .

RUN \
    npm install && \
    npm cache clean --force && \
    rm -rf /tmp/* /var/lib/apt/lists/* /var/tmp/* /usr/share/doc/*

COPY app app
COPY public public

EXPOSE 3016:3016

CMD npm start