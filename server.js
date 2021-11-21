require('dotenv').config()

const express                   = require('express')
const session                   = require('express-session')
const {check, validationResult} = require('express-validator')
const ejs                       = require('ejs')
const mysql                     = require('mysql')
const passport                  = require('passport')
const localStrategy             = require('passport-local').Strategy
const bcrypt                    = require('bcrypt')
const multer                    = require('multer')
const { google }                = require('googleapis')
const fs                        = require('fs')
const flash                     = require('connect-flash')
const app                       = express()
const favicon                   = require('serve-favicon')

const site_name = 'Picsel Hub'

// Database Connection
const db = mysql.createConnection({
    host : process.env.DB_HOST,
    database : process.env.DB_NAME.toString(),
    user : process.env.DB_USERNAME.toString(),
    password : process.env.DB_PASSWORD.toString(),
    stringifyObjects : 'Stringify',
    insecureAuth : true,
    dateStrings: true
})

db.connect((err) => {
    if(err){
        console.log(err)
    }
    console.log('Connected to Database')
})

// Google API setup
const auth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
)

auth2Client.setCredentials({
    refresh_token : process.env.REFRESH_TOKEN
})

const drive = google.drive({
    version : 'v3',
    auth : auth2Client
})

// Multer setup
const multer_storage = multer.diskStorage({
    destination : './public',
    filename : (req,file,done) => {
        const date_now = new Date(Date.now())
        const date = date_now.getFullYear() + '-' + date_now.getMonth() + '-' + date_now.getDate() 
        const time = date_now.getHours() + ':' + date_now.getMinutes()
        done(null, 'IMG_' + date + '_' + time)
    }
})

const multer_upload = multer({
    storage : multer_storage
})

// App Middleware
app.set('views-engine','ejs')
app.set('views',__dirname + '/views')
app.use(express.static(__dirname + '/public'))
app.use(session({
    secret : 'secret',
    resave : false,
    saveUninitialized : false
}))
app.use(express.urlencoded({extended : 'true'}))
app.use(express.json())
app.use(flash())
app.use(favicon(__dirname + '/public/fav/picsel_hub_favicon.png'))

// Passport
app.use(passport.initialize())
app.use(passport.session())

passport.use(new localStrategy({
    usernameField : 'username',
    passwordField : 'password',
    passReqToCallback : true
},( req , username , password , done ) => {

    var hashed_password = password

    try {
        db.query('SELECT * FROM picsel_hub.user WHERE USER_NAME = ?',[username],(err,rows) => {
            if(err){
                return done(err)
            }
    
            if(!rows.length){  
                return done(null,false, req.flash('message','User does not exist!'))
            }else{
                rows.forEach(element => {
                    console.log(rows)
    
                    bcrypt.compare(password , element.PASSWORD, (err,res) => {
                        console.log(password)
                        console.log(element.password)
                        console.log(res)
                        if(err){
                            console.log(err)
                        }
    
                        if(res == false){
                            return done(null,false, req.flash('message','Incorect Password!'))
                        }
    
                        return done(null, element)
                    })
                });
            } 
        })
    } catch (error) {
        console.log(error)
    }
}))

passport.serializeUser(function(user, done) {
    done(null, user.ID)
})

passport.deserializeUser(function(id, done) {
    db.query('SELECT * FROM picsel_hub.user WHERE ID = ' + id,function(err,rows){	
        rows.forEach(element => {
            done(err, element)
        })
    })
})

// GET Routes
app.get('/', is_signed_in,(req, res) => {
    res.render('home_page.ejs', {
        site : site_name,
        title : 'Home'
    })
})

app.get('/signin', is_signed_out ,(req,res) => {
    res.render('sign_in.ejs', {
        site : site_name,
        title : 'Sign In',
        message : req.flash('message')
    })
})

app.get('/signup', (req,res) => {
    res.render('sign_up.ejs', {
        site : site_name,
        title : 'Sign Up',
        message : req.flash('message')
    })
})

app.get('/u/home', is_signed_in , (req,res) => {
    const user_id = req.user.ID
    const username = req.user.USER_NAME
    const email = req.user.EMAIL

    try {
        db.query('SELECT * FROM picsel_hub.picture WHERE USER_ID = ?',[user_id], (err,rows) => {
            if(err){
                console.log(err)
            }else{
                db.query('SELECT * FROM picsel_hub.user WHERE ID <> ?',[user_id],(err,users) => {
                    if(err){
                        console.log(err)
                    }else{
                        res.render('user_page.ejs',{
                            site : site_name,
                            title : username,
                            user : username,
                            email : email,
                            row : rows,
                            users: users,
                            input_err : req.flash('input_err')
                        })
                    }
                })
            }         
        })
    } catch (error) {
        console.log(error)
    }
})

app.get('/u/shared', is_signed_in,(req,res) => {
    const user_id = req.user.ID
    const username = req.user.USER_NAME
    const email = req.user.EMAIL

    const query =   'SELECT shared_picture.ID, shared_picture.SHARED_USER_ID, picture.NAME, picture.LINK FROM picsel_hub.shared_picture, picsel_hub.picture WHERE SHARED_USER_ID = ? AND shared_picture.PICTURE_ID = picture.ID'                 

    try {
        db.query(query,[user_id], (err,rows) => {
            if(err){
                console.log(err)
            }else{
                res.render('user_page_shared.ejs',{
                    site : site_name,
                    title : username,
                    user : username,
                    email : email,
                    row : rows
                })
    
                console.log(rows)
                console.log(user_id)
            }         
        })
    } catch (error) {
        console.log(error)
    }
})

app.post('/u/search', (req,res,done) => {
    const search = req.body.search
    const user_id = req.user.ID
    const username = req.user.USER_NAME
    const email = req.user.EMAIL

    console.log(search)

    const query = 'SELECT * FROM picsel_hub.picture WHERE GEOLOCATION LIKE ? OR TAGS LIKE ? OR CAPTURED_BY LIKE ?'

    try {
        db.query(query, ['%' + search + '%','%' + search + '%','%' + search + '%'] , (err,rows) => {
            if(err){
                console.log(err)
            }else{
                if(!rows.length){
                    console.log('No Items')
                    console.log(user_id)
                    console.log(rows)
                }else{
                    db.query('SELECT * FROM picsel_hub.user WHERE ID <> ?',[user_id],(err,users) => {
                        if(err){
                            console.log(err)
                        }else{
                            res.render('user_page.ejs',{
                                site : site_name,
                                title : username,
                                user : username,
                                email : email,
                                row : rows,
                                users: users,
                                input_err : req.flash('input_err')
                            })
                        }
                    })
                }
            }
        })
    } catch (error) {
        console.log(error)
    }
})

app.get('/signout', (req,res) => {
    req.session.destroy()
    res.redirect('/')
})

// POST routes
app.post('/signin' ,passport.authenticate('local',{
    failureFlash : true,
    successRedirect : '/u/home',
    failureRedirect : '/signin',
    session : true
}))

app.post('/signup',[
    check('username', 'Username is required!').notEmpty(),

    check('email', 'Invalid email').isEmail().custom((val,{req}) => {
        if(val !== req.body.email_confirm){
            throw new Error('Email does not match')
        }else{
            return val
        }
    }),

    check('password', 'Password must be more than 2 characters').isLength(2).custom((val,{req}) => {
        if(val !== req.body.password_confirm){
            throw new Error('Password does not match')
        }else{
            return val
        }
    })
], async (req,res) => {
    const username         = req.body.username
    const email            = req.body.email
    const password         = req.body.password

    const hashed_password = await bcrypt.hash(password, 10)

    const errors = validationResult(req)

    if(!errors.isEmpty()){
        req.session.errors = errors

        const error = errors.array()

        error.forEach(err => {
            console.log(err.msg)

            req.flash('message', err.msg)
        })

        res.redirect('/signup')
    } else{
        db.query('INSERT INTO picsel_hub.user (USER_NAME,EMAIL,PASSWORD) VALUES(?,?,?)',[username,email,hashed_password],(err,results) => {
            if(err){
                console.log(err)
            }else{
                if(!results.length){
                    res.redirect('/signin');
                }else{
                    console.log(results)
                    req.flash('message','Incorect Password!')
                }
            }
        })
    }
})

app.post('/u',multer_upload.single('picture_file'),[
    check('captured_date', 'Please Enter Date').isDate()
],async (req,res) => {
    console.log(req.file.mimetype)
    console.log(req.user.ID)

    const uploaded_file = await drive.files.create({
        resource: {
            name : req.file.filename
        },
        media : {
            mimeType : req.file.mimetype,
            body : fs.createReadStream(req.file.path)
        }
    })

    try {
        fs.unlinkSync(req.file.path)
        console.log('delete success')
    } catch (err) {
        console.log(err)
    }

    drive.permissions.create({
        fileId : uploaded_file.data.id,
        requestBody : {
            role : 'reader',
            type : 'anyone'
        }
    })

    const uploaded_file_get_link = await drive.files.get({
        fileId : uploaded_file.data.id,
        fields : 'webViewLink,webContentLink'
    })

    console.log(uploaded_file.data)
    console.log(uploaded_file_get_link.data.webViewLink)


    const img_id            = uploaded_file.data.id
    const user_id           = req.user.ID
    const img_name          = uploaded_file.data.name
    const img_link          = uploaded_file_get_link.data.webContentLink
    const img_geolocation   = req.body.geolocation
    const img_tags          = req.body.tags
    const img_captured_date = req.body.captured_date
    const img_captured_by   = req.body.captured_by

    const username = req.user.USER_NAME
    const email = req.user.EMAIL
    
    const query = 'INSERT INTO picsel_hub.picture VALUES(?,?,?,?,?,?,?,?)'

    const errors = validationResult(req)

    console.log(errors)

    if(!errors.isEmpty()){
        req.session.errors = errors

        const error = errors.array()

        error.forEach(err => {
            console.log(err.msg)

            req.flash('input_err', err.msg)
        })

        res.redirect('/u/home')
    }else{
        db.query(query,[img_id, user_id, img_name, img_link, img_geolocation, img_tags, img_captured_date, img_captured_by],(err,rows) => {
            if(err){
                console.log(err)
            }else{
                res.redirect('/u/home')
            }
        })
    }

    

    console.log(img_captured_date)
})

app.post('/u/delete', async (req,res) => {
    const img_id = req.body

    console.log(img_id)

    try {
        const delete_file = await drive.files.delete({
            fileId : img_id
        })

        console.log(delete_file.data, delete_file.status)
    } catch (error) {
        console.log(error)
    }

    const query = 'DELETE FROM picsel_hub.picture WHERE ID = ?'

    try {
        db.query(query, [img_id], (err) => {
            if(err){
                console.log(err)
            }else{
                res.redirect('/u/home') 
            }
        })
    } catch (error) {
        console.log(error)
    }
})

app.post('/u/home/update/:id',async (req,res) => {
    const img_geolocation   = req.body.geolocation
    const img_tags          = req.body.tags
    const img_captured_date = req.body.captured_date
    const img_captured_by   = req.body.captured_by

    const img_id            = req.params.id

    const query = 'UPDATE picsel_hub.picture SET GEOLOCATION = ?, TAGS = ?, CAPTURED_DATE, CAPTURED_BY = ? WHERE ID = ?'

    try {
        db.query(query,[img_geolocation, img_tags, img_captured_date, img_captured_by, img_id],(err) => {
            if(err){
                console.log(err)
            }else{
                res.redirect('/u/home')
            }
        })
    } catch (error) {
        console.log(error)
    }
})

app.post('/u/share/:id', async (req,res) => {
    const user_id       = req.user.ID
    const to_user_id    = req.body.user_pick
    const img_id        = req.params.id

    const query = 'INSERT INTO picsel_hub.shared_picture (USER_ID,SHARED_USER_ID,PICTURE_ID) VALUES(?,?,?)'

    try {
        db.query(query,[user_id,to_user_id,img_id],(err) => {
            if(err){
                console.log(err)
            }else{
                res.redirect('/u/home')
            }
        })
    } catch (error) {
        console.log(error)
    }
})

// LISTENING TO PORT
app.listen('3001',() => {
    console.log('Server 3001')
})

// Functions
function is_signed_in(req,res,next){ //Check if the user is signed in
    if(req.isAuthenticated()){
        return next()
    }
    res.redirect('/signin')
}

function is_signed_out(req,res,next){ // Check if the user is signed out
    if(!req.isAuthenticated()){
        return next()
    }
    res.redirect('/u/home')
}