FROM node:18-alpine 

WORKDIR /src

COPY package.json .

RUN npm install

COPY app app
COPY public public

EXPOSE 3016:3016

CMD npm start