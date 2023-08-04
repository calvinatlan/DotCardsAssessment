
# Dot.Cards Assessment

***

## How to Run

1. Install docker and docker compose
2. Clone this repository and navigate to its root folder in your command line of choice
3. Copy the ```.env.template``` file and name the copy ```.env```. Edit this new file to have a secure password instead of ```MYPASSWORD```
4. Run ```docker compose up``` to start the containers and monitor output
5. Test endpoints at [https://localhost:8080/{endpoint}](https://localhost:8080/) using method of choice (I used Postman)
6. Press ctrl+c to shut down containers
7. Change ```schema.json``` and re-run ```docker compose up``` to test the schema parsing

Notes: Only "integer" and "string" are supported in the schema.json file for column types

***

## Endpoints

- **Create** 
  - URL ```/:collection```
  - HTTP Method: POST 
  - Example url and body:

```
    url: http://localhost:8080/person
    method: POST
    body :
    {
        "name": "Calvin",
        "age": 30,
        "country": "France"
    }
```

- **Read**
    - URL ```/:collection/:id```
    - HTTP Method: GET

- **Update**
    - URL ```/:collection/:id```
    - HTTP Method: POST
    - Example url and body:

```
    url: http://localhost:8080/person/1
    method: POST
    body :
    {
        "name": "Sam",
        "age": 34
    }
```

- **Delete**
    - URL ```/:collection/:id```
    - HTTP Method: DELETE

***

### Ways I would improve this

- Clean up typing
- Use an ORM
- Add logging
- Add support for more data types in the database schema parsing
- Better input validation
- More robust error handling (currently some of the errors are not very helpful)
- I use a naive timeout if database is not ready before app container. It would be better to perform some sort of health check 
to guarantee the db is fully ready before starting the node app.
- Different authentication method (currently using unsafe ```mysql_native_password```)
