
# Dot.Cards Assessment

***

## How to Run

1. Install docker desktop or docker engine from  https://docs.docker.com/engine/install/
2. Clone this repository and navigate to it in your command line of choice
3. Copy the ```.env.template``` file and name the copy ```.env```. Edit this new file to have a secure password instead of MYPASSWORD
4. Run ```docker-compose up -d``` to start the containers in detached mode
5. Test endpoints at [https://localhost:8080/{endpoint}](https://localhost:8080/) using method of choice (I used Postman)
6. Run ```docker-compose stop``` to shut down the containers

***

## Endpoints

- POST /:collection
- GET /:collection/:id
- POST /:collection/:id
- DELETE /:collection/:id

***

### Notes

- The mysql image uses ```mysql_native_password``` for the ```default-authentication-plugin``` argument,
which is not recommended for production environments.