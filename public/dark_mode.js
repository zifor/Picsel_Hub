let dark_mode = localStorage.getItem('dark_mode');
let toggle = localStorage.getItem('toggle');

const dark_mode_toggle = document.querySelector('#toggle-dark-mode');

const enable_dark_mode = () => {
    document.body.classList.add('darkmode');

    localStorage.setItem('dark_mode', 'enabled');
};

const disable_dark_mode = () => {
    document.body.classList.remove('darkmode');
    
    localStorage.setItem('dark_mode', null);
};

if (dark_mode === 'enabled')
{
    enable_dark_mode();
    dark_mode_toggle.checked = true;
}

dark_mode_toggle.addEventListener('click', () => {
    dark_mode = localStorage.getItem('dark_mode');
    if(dark_mode !== 'enabled')
    {
        enable_dark_mode();
    }
    else
    {
        disable_dark_mode();
    }
})

