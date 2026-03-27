FROM nginx:alpine
RUN rm -rf /etc/nginx/nginx.conf
COPY nginx.conf /etc/nginx/orion.conf
CMD ["nginx", "-g", "daemon off;", "-c", "/etc/nginx/orion.conf"]
