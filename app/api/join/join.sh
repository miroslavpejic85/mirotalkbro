#!/bin/bash

API_KEY_SECRET="mirotalkbro_default_secret"
MIROTALK_URL="https://bro.mirotalk.com/api/v1/join"
#MIROTALK_URL="http://localhost:3016/api/v1/join"

curl $MIROTALK_URL \
    --header "authorization: $API_KEY_SECRET" \
    --header "Content-Type: application/json" \
    --data '{"room":"test"}' \
    --request POST