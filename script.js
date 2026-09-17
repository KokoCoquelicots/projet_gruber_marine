document.addEventListener('DOMContentLoaded', function () {

  const form = document.getElementById('inscriptionForm');
  const errorMessage = document.getElementById('errorMessage');
  const recap = document.getElementById('recap');
  const retourBtn = document.getElementById('retourBtn');

  // Champs du formulaire
  const fields = {
    login: document.getElementById('login'),
    password: document.getElementById('password'),
    confirmPassword: document.getElementById('confirmPassword'),
    nom: document.getElementById('nom'),
    prenom: document.getElementById('prenom'),
    adresse: document.getElementById('adresse'),
    email: document.getElementById('email'),
    telephone: document.getElementById('telephone'),
    dateNaissance: document.getElementById('dateNaissance'),
  };

  function afficherErreur(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
  }

  function cacherErreur() {
    errorMessage.textContent = '';
    errorMessage.classList.remove('show');
  }

  function marquerInvalide(champ) {
    champ.classList.add('invalid');
  }

  function reinitialiserStyles() {
    Object.values(fields).forEach(function (champ) {
      champ.classList.remove('invalid');
    });
  }

  function emailEstValide(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    cacherErreur();
    reinitialiserStyles();

    // 1. Vérifier que tous les champs sont remplis
    let champVide = null;
    for (const cle in fields) {
      if (fields[cle].value.trim() === '') {
        champVide = fields[cle];
        break;
      }
    }

    if (champVide) {
      marquerInvalide(champVide);
      afficherErreur('Veuillez remplir tous les champs du formulaire.');
      champVide.focus();
      return;
    }

    // 2. Vérifier que l'email est valide
    if (!emailEstValide(fields.email.value.trim())) {
      marquerInvalide(fields.email);
      afficherErreur("L'adresse email saisie n'est pas valide.");
      fields.email.focus();
      return;
    }

    // 3. Vérifier que le mot de passe et la confirmation correspondent
    if (fields.password.value !== fields.confirmPassword.value) {
      marquerInvalide(fields.password);
      marquerInvalide(fields.confirmPassword);
      afficherErreur('Le mot de passe et sa confirmation ne correspondent pas.');
      fields.confirmPassword.focus();
      return;
    }

    // 4. Tout est correct : afficher le récapitulatif (sans le mot de passe)
    document.getElementById('recapLogin').textContent = fields.login.value.trim();
    document.getElementById('recapNom').textContent = fields.nom.value.trim();
    document.getElementById('recapPrenom').textContent = fields.prenom.value.trim();
    document.getElementById('recapAdresse').textContent = fields.adresse.value.trim();
    document.getElementById('recapEmail').textContent = fields.email.value.trim();
    document.getElementById('recapTelephone').textContent = fields.telephone.value.trim();
    document.getElementById('recapDateNaissance').textContent = formaterDate(fields.dateNaissance.value);

    form.classList.add('hidden');
    recap.classList.remove('hidden');
  });

  // Bouton retour : réaffiche le formulaire vide
  retourBtn.addEventListener('click', function () {
    form.reset();
    reinitialiserStyles();
    cacherErreur();
    recap.classList.add('hidden');
    form.classList.remove('hidden');
  });

  function formaterDate(dateISO) {
    if (!dateISO) return '';
    const [annee, mois, jour] = dateISO.split('-');
    return `${jour}/${mois}/${annee}`;
  }

});