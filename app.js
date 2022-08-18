import express from 'express'
import mysql from 'mysql'
import bcrypt, { hash } from 'bcrypt'
import session from 'express-session'
import multer from 'multer'

const app = express()

//set diskstorage for files
const upload = multer({ dest: 'public/uploads/'})


//establish connection with database
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'evs_db'
})

//set type of templating engine used - embedded javascript(ejs)
app.set('view engine', 'ejs')
//where to source for static file
app.use(express.static('public'))

//configuration to retrieve form data
app.use(express.urlencoded({extended:false}))

//prepare to use session
app.use(session({
    secret:'screen',
    resave: false,
    saveUninitialized: false
}))

//check for login each time
app.use((req,res,next) => {
    if(req.session.userID === undefined) {
        res.locals.isLoggedIn = false //if the session of the userID is undefined, the user is not logged in
    } else {
        res.locals.isLoggedIn = true // otherwise this person is logged in
        res.locals.username = req.session.username
    }
    next()
})

// ROUTES
// homepage
app.get('/', (req,res) => {
    res.render('index')
})


// dashboard
app.get('/dashboard', (req,res) => {
    if (res.locals.isLoggedIn) {

    let sql = `SELECT * FROM voters JOIN profile ON v_id = v_id_fk WHERE profile_status = 'COMPLETE' AND v_id = ${req.session.userID}`

    connection.query(
        sql, 
        (error, results) => {
            let profile = results[0]
            connection.query(
                'SELECT * FROM voters JOIN profile ON v_id_fk = v_id WHERE post = ? OR (post = ? AND county = ?) OR (post = ? AND county = ?) OR (post = ? AND county = ?) OR (post = ? AND constituency = ?) OR (post = ? AND assembly_ward = ?)',
                ['President','Governor', profile.county, 'Senator', profile.county, 'Women Representative', profile.county, 'Member of Parliament', profile.constituency, 'Member of County Assembly', profile.assembly_ward], 
                (error, results) => {
                    res.render('dashboard', {profile: profile, candidates:results})
                }
            )
            
        }
    )

    } else {
         res.redirect('/login')
        }   
})


// vote
app.get('/vote', (req, res) => {
    if (res.locals.isLoggedIn) {

        if(req.session.hasVoted === 'YES') {
            let sql = `SELECT * FROM voters JOIN profile ON v_id = v_id_fk JOIN votes ON votes.v_id_fk = profile.v_id_fk WHERE profile_status = 'COMPLETE' AND v_id = ${req.session.userID}`
    
            connection.query(
                sql, 
                (error, results) => {
                    let profile = results[0]
                    connection.query(
                        'SELECT * FROM voters JOIN profile ON v_id_fk = v_id WHERE post = ? OR (post = ? AND county = ?) OR (post = ? AND county = ?) OR (post = ? AND county = ?) OR (post = ? AND constituency = ?) OR (post = ? AND assembly_ward = ?)',
                        ['President','Governor', profile.county, 'Senator', profile.county, 'Women Representative', profile.county, 'Member of Parliament', profile.constituency, 'Member of County Assembly', profile.assembly_ward], 
                        (error, results) => {
                            res.render('vote', {profile: profile, candidates:results})
                        }
                    )            
                    
                }
            )

        } else {
            let sql = `SELECT * FROM voters JOIN profile ON v_id = v_id_fk WHERE profile_status = 'COMPLETE' AND v_id = ${req.session.userID}`
    
            connection.query(
                sql, 
                (error, results) => {
                    let profile = results[0]
                    connection.query(
                        'SELECT * FROM voters JOIN profile ON v_id_fk = v_id WHERE post = ? OR (post = ? AND county = ?) OR (post = ? AND county = ?) OR (post = ? AND county = ?) OR (post = ? AND constituency = ?) OR (post = ? AND assembly_ward = ?)',
                        ['President','Governor', profile.county, 'Senator', profile.county, 'Women Representative', profile.county, 'Member of Parliament', profile.constituency, 'Member of County Assembly', profile.assembly_ward], 
                        (error, results) => {
                            res.render('vote', {profile: profile, candidates:results})
                        }
                    )            
                    
                }
            )
        }

 
    
        } else {
             res.redirect('/login')
            }   
})

app.post('/vote/:id' , (req,res) => {
    const selectedCandidates = {
        president: req.body.president,
        mp:req.body.mp,
        senator:req.body.senator,
        womenRep:req.body.womenRep,
        governor:req.body.governor,
        mca:req.body.mca
    }

    let sql = 'INSERT INTO votes (v_id_fk, president, mp, senator, women_rep, governor, mca) VALUES (?,?,?,?,?,?,?)'

    connection.query(
       sql,
       [
        parseInt(req.params.id),
        selectedCandidates.president,
        selectedCandidates.mp,
        selectedCandidates.senator,
        selectedCandidates.womenRep,
        selectedCandidates.governor,
        selectedCandidates.mca
       ],
       (error,results) => {
            connection.query(
                'UPDATE voters SET has_voted = ? WHERE v_id = ?',
                ['YES', parseInt(req.params.id)],
                (error,results) => {
                    req.session.hasVoted = 'YES'
                    res.redirect('/dashboard')
                }
            )
           
       }
    )

    // connection.query(
    //     'SELECT * FROM votes WHERE v_id_fk = ?',
    //     [parseInt(req.params.id)],
    //     (error,results) => {
    //         if (results.length > 0) {
    //             res.send('Already voted')
    //         } else {
 
    //         }
    //     }
    // )

})

//profile
app.get('/profile', (req,res) => {
   if (res.locals.isLoggedIn) {
    res.render('profile', {userID : req.session.userID})
   } else {
       res.redirect('/login')
   }
}) 

const profiles = []

//complete profile
app.post('/complete-profile', upload.single('photo_url'), (req, res) => {
 
    if (req.body.vying === 'false') {
        let sql = 'INSERT INTO profile (v_id_fk, national_id, photo_url, polling_station, county, constituency, assembly_ward) VALUES (?,?,?,?,?,?,?)'

        connection.query(
            /*sql statement*/
            sql, 
            [   
                req.session.userID, 
                req.body.national_id,
                req.file.filename,
                req.body.polling_station, 
                req.body.county,
                req.body.constituency,
                req.body.assembly_ward
            ],
        /*callback function*/
            (error, results) => {

                let sql = 'UPDATE voters SET profile_status = ? WHERE v_id =?'

                connection.query(
                    sql, ['COMPLETE', req.session.userID], (error, results) => {
                        res.redirect('/dashboard')
                    }
                )
            }
        )
    } else {
        let sql = 'INSERT INTO profile (v_id_fk, national_id, photo_url, polling_station, county, constituency, assembly_ward, vying, post, party) VALUES (?,?,?,?,?,?,?,?,?,?)'
        connection.query(
            /*sql statement*/
            sql, 
            [   
                req.session.userID, 
                req.body.national_id,
                req.file.filename,
                req.body.polling_station, 
                req.body.county,
                req.body.constituency,
                req.body.assembly_ward,
                'true',
                req.body.post,
                req.body.party
            ],
        /*callback function*/
            (error, results) => {

                let sql = 'UPDATE voters SET profile_status = ? WHERE v_id =?'

                connection.query(
                    sql, ['COMPLETE', req.session.userID], (error, results) => {
                        res.redirect('/dashboard')
                    }
                )
            }
        )
    }



    
})

//edit profile
app.get('/edit-profile/:id', (req,res) => {
    if (res.locals.isLoggedIn) {
        let sql = `SELECT *FROM voters JOIN profile ON v_id = v_id_fk WHERE V_id_fk = ${req.params.id}` 
        connection.query(
            sql, (error, results) => {
                res.render('edit-profile', {profile: results[0]})
            }
        )
       
       } else {
           res.redirect('/login')
       }
})

//submit edit profile form
app.post('/edit-profile/:id', upload.single('photo_url'), (req, res) => {
    const profile = {
        name: req.body.fullname,
        email: req.body.email,
        nationalID: req.body.national_id,
        county: req.body.county,
        constituency: req.body.constituency,
        assemblyWard: req.body.assembly_ward,
        pollingStation: req.body.polling_station,
        picture:  req.file,
        post: req.body.post,
        party: req.body.party
    }

  

    let sql = 'UPDATE voters SET fullname = ?, email = ? WHERE v_id = ?' 

    connection.query(
        sql,
         [profile.name, profile.email, parseInt(req.params.id)],
         (error, results) => {

            let sql
            if(profile.picture === undefined){
                sql = 'UPDATE profile SET national_id = ?, polling_station = ?, county = ?, constituency = ?, assembly_ward = ?, post = ?, party = ?  WHERE v_id_fk = ?'
                connection.query(
                    sql,
                     [
                         profile.nationalID,
                         profile.pollingStation,
                         profile.county,
                         profile.constituency,
                         profile.assemblyWard,
                         profile.post,
                         profile.party,
                         parseInt(req.params.id)

                    ],
                     (error, results) => {
                        res.redirect('/dashboard')
                    }
                )
            } else {
                sql = 'UPDATE profile SET national_id = ?, photo_url = ?,  polling_station = ?, county = ?, constituency = ?, assembly_ward = ?, post = ?, party = ?  WHERE v_id_fk = ?'
                connection.query(
                    sql,
                    [
                        profile.nationalID,
                        profile.picture.filename,
                        profile.pollingStation,
                        profile.county,
                        profile.constituency,
                        profile.assemblyWard,
                        profile.post,
                        profile.party,
                        parseInt(req.params.id)

                   ],
                    (error, results) => {
                        res.redirect('/dashboard')
                    }
                )
            }
        }
    )
})


//display login form
//we are requesting something
app.get('/login', (req,res) =>{
   const user = {
       email: '',
       password: ''
   }
    res.render('login', {error:false, user: user})
})

//submit login form
//we expect a change in the database==we are sending something
app.post('/login', (req,res) => {
   
    const user = {
        email: req.body.email,
        password: req.body.password
    }
    
let sql = 'SELECT * FROM voters WHERE email =?'

    connection.query(
        sql,
        [user.email],
        (error, results) => {
            if(results.length > 0) {
                bcrypt.compare(user.password, results[0].password,(error, matches) => {
                    if(matches) {
                        req.session.userID = results[0].v_id
                        req.session.username = results[0].fullname.split(' ')[0]
                        req.session.hasVoted = results[0].has_voted
                        if(results[0].profile_status === 'INCOMPLETE') {   
                            res.redirect('/profile')
                            console.log(req.sessionID.userID)
                        } else {
                            res.redirect('/dashboard')
                        }
                    }else {
                        let message = 'Email/Password mismatch.'
                    
                        res.render('login',{
                            error: true,
                            message: message,
                            user: user
                        })
                    }
                })    
            } else {
                let message = 'Account does not exist. Please create one to log in'
                res.render('login', {
                error: true, 
                message: message,
                user: user,
        })
            }
        }
    )
})

//display signup
app.get('/signup', (req, res) => {
    const user = {
        fullname:'',
        email:'',
        password:'',
        confirmPassword: ''
    }
    res.render('signup', {error: false, user: user})
})



//submit signup form
app.post('/signup', (req, res) => {

    
//validation for backend
    if(req.body.password === req.body.confirmPassword) {

        let sql = 'SELECT email FROM voters WHERE email = ?'
        connection.query(sql, [req.body.email], (error,results) => {
            if(results.length > 0){
                const user = {
                    fullname: req.body.fullname,
                    email: req.body.email,
                    password: req.body.password,
                    confirmPassword: req.body.confirmPassword
                }
                let message = 'Account with email provided already exists.'
                res.render('signup', {
                    error:true,
                    message: message,
                    user:user
                })
            } else {
                bcrypt.hash(req.body.password, 10, (error, hash) => {
                    const user = {
                        fullname: req.body.fullname,
                        email: req.body.email,
                        password: hash
            
                    }

                        let sql = 'INSERT INTO voters (fullname, email, password) VALUES(?,?,?)'

                        connection.query(
                            sql, [user.fullname,user.email, user.password],
                            (eror, results) => {
                                res.redirect('/login')
                            }
                        )
                    })
                }
            }
        )

    } else {
        const user = {
            fullname: req.body.fullname,
            email: req.body.email,
            password: req.body.password,
            confirmPassword: req.body.confirmPassword
        }
        let message = 'Password/Confirm password mismatch!'
        res.render('signup', {
            error:true,
            message: message,
            user:user
        })
    }
})
  
// logout functionality
app.get('/logout', (req, res) => { //when logging out we are destroying the session
    req.session.destroy((error )/*in the event it fails to destroy we shll display the error*/ => {
        res.redirect('/')
    })
})

app.get('*', (req, res) => {
    res.send('404 \nPage Not Found!')
})




const PORT = process.env.PORT || 3000 

app.listen(PORT, () => {
    console.log('Server Up: Application running...')
})

