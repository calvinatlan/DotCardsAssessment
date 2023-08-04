
# Dot.Cards Assessment

***

## How to Run

1. Install docker desktop or docker engine from  https://docs.docker.com/engine/install/
2. Clone this repository and navigate to it in your command line of choice
3. Copy the ```.env.template``` file and name the copy ```.env```. Edit this new file to have a secure password instead of ```MYPASSWORD```
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

### Ways I would improve this

- Clean up typing
- Use an ORM
- Add support for more data types in the database schema parsing
- Make input validation more robust
- Use proper exception handling instead of catching every error and spitting it out as the response (Dangerous, would never do this)
- Docker compose guarantees that the db container has started before the node app's container starts
but this does not guarantee the db is ready for connection. I would perform some sort of health check 
to guarantee the db is fully ready before starting the node app.

***

### Notes

- The mysql image uses ```mysql_native_password``` for the ```default-authentication-plugin``` argument,
which is not recommended for production environments.
